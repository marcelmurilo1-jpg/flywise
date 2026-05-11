import { Router } from 'express';
import pLimit from 'p-limit';
import { supabase } from '../lib/supabase.js';
import { requireAdminJWT, requireSyncSecret } from '../middleware/auth.js';
import { getBrowser, ensureChromium } from '../scraper/browser.js';
import { refreshPromotionsCache, DEFAULT_PROMOTIONS_SEED, resetPromotionsCacheAt } from './transferPromos.js';

const router = Router();

// Estado do sync em tempo real — permite que o admin UI faça polling de progresso
let _syncState = { inProgress: false, step: 'idle', startedAt: null, lastResult: null };

// ── Helpers para sync de promoções de transferência ───────────────────────────

function parsePromoDate(validUntil) {
    if (!validUntil) return null;
    const s = validUntil.toLowerCase();

    if (/\b(hoje|today|acaba hoje|até hoje)\b/.test(s)) {
        const d = new Date();
        d.setHours(23, 59, 59, 999);
        return d;
    }

    const iso = validUntil.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return new Date(`${iso[1]}-${iso[2]}-${iso[3]}T23:59:59`);

    const br = validUntil.match(/(\d{1,2})\/(\d{2})\/(\d{4})/);
    if (br) return new Date(`${br[3]}-${br[2]}-${br[1].padStart(2, '0')}T23:59:59`);

    const MONTHS = { janeiro:'01', fevereiro:'02', 'março':'03', marco:'03', abril:'04',
        maio:'05', junho:'06', julho:'07', agosto:'08', setembro:'09',
        outubro:'10', novembro:'11', dezembro:'12' };
    const ext = s.match(/(\d{1,2})\s+de\s+([a-zç]+)\s+de\s+(\d{4})/);
    if (ext && MONTHS[ext[2]]) {
        return new Date(`${ext[3]}-${MONTHS[ext[2]]}-${ext[1].padStart(2,'0')}T23:59:59`);
    }
    return null;
}

async function checkAndExpirePromotions(promotions) {
    if (!promotions?.length) return 0;
    const now = new Date();
    let expired = 0;

    for (const p of promotions) {
        const expiry = parsePromoDate(p.valid_until);
        if (!expiry || now <= expiry) continue;
        if (p.bonus_percent === 0 && p.club_bonus_percent === 0) continue;

        console.log(`[TransferSync] Promoção expirada: ${p.card_id}/${p.program} (até ${p.valid_until})`);
        const { error } = await supabase
            .from('transfer_promotions')
            .update({
                bonus_percent: 0,
                club_bonus_percent: 0,
                club_tier_bonuses: {},
                valid_until: `Expirado em ${p.valid_until}`,
                updated_at: now.toISOString(),
            })
            .eq('card_id', p.card_id)
            .eq('program', p.program);

        if (error) console.error(`[TransferSync] Erro ao expirar ${p.card_id}/${p.program}:`, error.message);
        else expired++;
    }
    return expired;
}

const TRANSFER_SOURCES = [
    // PdP tem categoria dedicada a bônus de transferência — fonte mais específica
    { id: 'rss_pprimeira_bonus', url: 'https://www.passageirodeprimeira.com.br/category/bonus-de-transferencia/feed', label: 'RSS PdP — Bônus de Transferência' },
    { id: 'rss_pprimeira_milhas', url: 'https://www.passageirodeprimeira.com.br/category/milhas/feed', label: 'RSS PdP — Milhas' },
    { id: 'rss_pprimeira', url: 'https://www.passageirodeprimeira.com.br/feed', label: 'RSS Passageiro de Primeira' },
    { id: 'rss_melhores', url: 'https://www.melhores-destinos.com.br/feed', label: 'RSS Melhores Destinos' },
    // Melhores Cartões — scraper Playwright que também popula tabela promocoes
    { id: 'web_melhorescartoes', url: 'https://www.melhorescartoes.com.br/c/promocoes-milhas', label: 'Melhores Cartões — Promoções Milhas' },
];

async function scrapeTransferSource(source) {
    try {
        // ── RSS/Feed path ────────────────────────────────────────────────────────
        if (source.id.startsWith('rss_') || source.url.includes('feed')) {
            const res = await fetch(source.url, {
                headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FlyWise-Bot/1.0)' },
                signal: AbortSignal.timeout(15000),
            });
            if (!res.ok) return null;
            const text = await res.text();

            const titles = [];
            const titleRe = /<title>([\s\S]*?)<\/title>/gi;
            let tm;
            while ((tm = titleRe.exec(text)) !== null) titles.push(tm[1]);

            const stripped = text
                .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
                .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#\d+;/g, '')
                .replace(/<[^>]+>/g, ' ')
                .replace(/\s+/g, ' ');

            const keywords = ['bônus', 'bonus', '%', 'transferên', 'transfer', 'smiles', 'tudoazul', 'latam', 'livelo', 'inter', 'clube', 'promo', 'nubank', 'iupp', 'esfera', 'itaú', 'btg', 'caixa', 'santander', 'bradesco', 'c6', 'xp', 'amex', 'american express', 'pontos', 'milhas', 'campanha', 'promoção', 'válido', 'válida', 'até', 'encerra', 'banco'];
            const sentences = stripped.split(/[.!?]\s+/);
            const relevant = sentences.filter(s => keywords.some(k => s.toLowerCase().includes(k)));

            const titlesText = titles.slice(1, 40).join('\n');
            const bodyText = relevant.slice(0, 300).join('. ');
            return { id: source.id, label: source.label, content: `TÍTULOS:\n${titlesText}\n\nCONTEÚDO:\n${bodyText}` };
        }

        // ── Melhores Cartões — scraper estruturado ───────────────────────────────
        // Extrai artigos da listagem, faz upsert na tabela promocoes (dedup por URL)
        // e retorna conteúdo para o Claude analisar transfer_promotions
        if (source.id === 'web_melhorescartoes') {
            await ensureChromium();
            const browser = await getBrowser();
            const context = await browser.newContext({
                locale: 'pt-BR',
                extraHTTPHeaders: { 'Accept-Language': 'pt-BR,pt;q=0.9' },
            });
            const page = await context.newPage();
            try {
                await page.goto(source.url, { waitUntil: 'networkidle', timeout: 35000 });
                await new Promise(r => setTimeout(r, 2000 + Math.random() * 1000));
                try {
                    await page.click('button:has-text("Aceitar"), button:has-text("Accept"), button:has-text("Concordo"), button:has-text("OK")', { timeout: 3000 });
                    await new Promise(r => setTimeout(r, 600));
                } catch (_) {}

                // Extrai artigos estruturados — tenta múltiplos seletores WordPress/custom
                const articles = await page.evaluate(() => {
                    const candidates = [
                        ...document.querySelectorAll('article'),
                        ...document.querySelectorAll('.post, .card-post, .item-post, [class*="post-item"], [class*="article-card"], [class*="card-article"]'),
                    ];
                    const seen = new Set();
                    const result = [];
                    for (const el of candidates) {
                        const link = el.querySelector('a[href]');
                        const href = link?.href ?? '';
                        if (!href || seen.has(href)) continue;
                        seen.add(href);
                        const titleEl = el.querySelector('h2, h3, h4, .title, .post-title, .entry-title');
                        const excerptEl = el.querySelector('p, .excerpt, .post-excerpt, .entry-summary, .description');
                        const dateEl = el.querySelector('time, .date, .post-date, .meta-date, .entry-date');
                        const title = titleEl?.innerText?.trim() ?? link?.innerText?.trim() ?? '';
                        if (!title) continue;
                        result.push({
                            url: href,
                            titulo: title,
                            conteudo: excerptEl?.innerText?.trim() ?? '',
                            date: dateEl?.getAttribute('datetime') ?? dateEl?.innerText?.trim() ?? '',
                        });
                        if (result.length >= 40) break;
                    }
                    return result;
                });

                console.log(`[TransferSync] Melhores Cartões: ${articles.length} artigos extraídos`);

                // Keywords para filtrar promos de milhas/transferência
                const promoKeywords = ['bônus', 'bonus', '%', 'transfer', 'smiles', 'tudoazul', 'latam', 'livelo', 'milhas', 'pontos', 'promoç', 'campanha', 'nubank', 'itaú', 'bradesco', 'santander', 'c6', 'inter', 'btg', 'xp', 'amex'];
                const milesArticles = articles.filter(a =>
                    promoKeywords.some(k => (a.titulo + ' ' + a.conteudo).toLowerCase().includes(k))
                );

                // Upsert na tabela promocoes (dedup por URL) — sem conflito com outros scrapers
                if (supabase && milesArticles.length > 0) {
                    // Busca URLs já existentes para logar novidades
                    const urls = milesArticles.map(a => a.url);
                    const { data: existing } = await supabase
                        .from('promocoes')
                        .select('url')
                        .in('url', urls);
                    const existingUrls = new Set((existing ?? []).map(r => r.url));
                    const newOnes = milesArticles.filter(a => !existingUrls.has(a.url));

                    if (newOnes.length > 0) {
                        const rows = newOnes.map(a => ({
                            titulo: a.titulo,
                            url: a.url,
                            conteudo: a.conteudo,
                            fonte: 'melhorescartoes.com.br',
                            categoria: 'milhas',
                            tipo: 'bonus_transferencia',
                            subcategoria: 'transferencia',
                            valid_until: null,
                        }));
                        const { error: upsertErr } = await supabase
                            .from('promocoes')
                            .upsert(rows, { onConflict: 'url', ignoreDuplicates: true });
                        if (upsertErr) console.warn('[TransferSync] Erro ao inserir em promocoes:', upsertErr.message);
                        else console.log(`[TransferSync] Melhores Cartões: ${newOnes.length} nova(s) promo(s) inserida(s) em promocoes`);
                    } else {
                        console.log('[TransferSync] Melhores Cartões: nenhum artigo novo em promocoes');
                    }
                }

                // Conteúdo para o Claude analisar transfer_promotions
                const contentLines = milesArticles
                    .map(a => `• ${a.titulo}${a.conteudo ? ' — ' + a.conteudo.slice(0, 120) : ''}`)
                    .join('\n');
                return { id: source.id, label: source.label, content: `ARTIGOS (${milesArticles.length}):\n${contentLines}` };

            } finally {
                await context.close().catch(() => {});
            }
        }

        // ── Web genérico (Playwright, só texto) ──────────────────────────────────
        await ensureChromium();
        const browser = await getBrowser();
        const context = await browser.newContext({
            locale: 'pt-BR',
            extraHTTPHeaders: { 'Accept-Language': 'pt-BR,pt;q=0.9' },
        });
        const page = await context.newPage();
        try {
            await page.goto(source.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await new Promise(r => setTimeout(r, 2500 + Math.random() * 1000));
            try {
                await page.click('button:has-text("Aceitar"), button:has-text("Accept"), button:has-text("Concordo")', { timeout: 3000 });
                await new Promise(r => setTimeout(r, 800));
            } catch (_) {}
            const content = await page.evaluate(() => {
                const remove = document.querySelectorAll('script, style, nav, footer, header');
                remove.forEach(el => el.remove());
                return document.body?.innerText?.slice(0, 3000) ?? '';
            });
            return { id: source.id, label: source.label, content };
        } finally {
            await context.close().catch(() => {});
        }
    } catch (err) {
        console.warn(`[TransferSync] Falha ao scraper ${source.id}:`, err.message);
        return null;
    }
}

async function analyzeTransferDataWithClaude(scrapedContents, currentPromotions) {
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) throw new Error('ANTHROPIC_API_KEY não configurada');

    const currentCompact = (currentPromotions ?? []).map(r => ({
        card_id: r.card_id, program: r.program,
        bonus_percent: r.bonus_percent, club_bonus_percent: r.club_bonus_percent,
        club_tier_bonuses: r.club_tier_bonuses, valid_until: r.valid_until,
        is_periodic: r.is_periodic, rules: r.rules,
    }));
    const currentJson = JSON.stringify(currentCompact, null, 1);

    const scrapedText = scrapedContents
        .filter(Boolean)
        .map(s => `\n### ${s.label}\n${s.content.slice(0, 4000)}`)
        .join('\n')
        .slice(0, 28000);

    const prompt = `Você é especialista em programas de milhas e fidelidade do Brasil. Analise os dados extraídos das páginas oficiais e blogs abaixo e compare com os dados atuais do banco de dados do FlyWise.

## DADOS ATUAIS NO BANCO (JSON):
${currentJson}

## DADOS EXTRAÍDOS DAS PÁGINAS OFICIAIS:
${scrapedText}

## TAREFA:
Analise cuidadosamente e retorne um JSON com as promoções de transferência atualizadas. Mantenha EXATAMENTE a mesma estrutura dos dados atuais. Para cada promoção, verifique:
1. bonusPercent — bônus para quem não tem clube (%)
2. clubBonusPercent — bônus genérico para assinantes de clube (%)
3. clubTierBonuses — bônus específico por plano do clube
4. validUntil — validade. Se encontrar data EXPLÍCITA, coloque em formato ISO no início
5. rules — array de strings com regras importantes
6. description — descrição resumida (máx 120 chars)
7. isPeriodic — true se campanha periódica
8. lastConfirmed — "${new Date().toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).replace(/\./g, '').replace(/^(.)/, c => c.toUpperCase())}"
9. baseRatio — ratio BASE de transferência como número decimal (ex: 1.0 para 1:1, 0.5 para 2:1, 2.5 para 1:2.5). Extraia do conteúdo das fontes. Se não encontrar, omita o campo.

REGRAS: Se não encontrou, mantenha o valor atual. Santander Esfera 20% para Smiles é PERMANENTE. Não invente dados. Não altere card_id, program, club_required.

Retorne SOMENTE JSON válido:
{
  "changes_detected": boolean,
  "summary": "resumo em português",
  "promotions": [ ... array completo ... ]
}`;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'x-api-key': anthropicKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
        },
        body: JSON.stringify({
            model: 'claude-sonnet-4-6',
            max_tokens: 8192,
            system: 'Responda SOMENTE com JSON válido. Sem markdown, sem blocos de código.',
            messages: [{ role: 'user', content: prompt }],
        }),
        signal: AbortSignal.timeout(60000),
    });

    if (!res.ok) {
        const errBody = await res.text().catch(() => '');
        throw new Error(`Anthropic API error: ${res.status} — ${errBody.slice(0, 300)}`);
    }
    const data = await res.json();
    const text = data.content?.[0]?.text ?? '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Claude não retornou JSON válido');
    return JSON.parse(jsonMatch[0]);
}

export async function syncTransferData() {
    if (!supabase) throw new Error('Supabase não configurado');
    if (_syncState.inProgress) throw new Error('Sync já em andamento');

    console.log('[TransferSync] Iniciando sync de dados de transferência...');
    const startedAt = new Date().toISOString();
    let validScraped = [];
    let updatedCount = 0;
    const allDiffs = [];

    _syncState = { inProgress: true, step: 'scraping', startedAt, lastResult: null };

    try {
        console.log('[TransferSync] ANTHROPIC_API_KEY configurada:', !!process.env.ANTHROPIC_API_KEY);

        const { data: current, error: fetchErr } = await supabase
            .from('transfer_promotions')
            .select('*')
            .eq('active', true);
        if (fetchErr) throw new Error(`Supabase fetch: ${fetchErr.message}`);
        console.log(`[TransferSync] ${current?.length ?? 0} promoções no Supabase`);

        const expiredCount = await checkAndExpirePromotions(current ?? []);
        if (expiredCount > 0) console.log(`[TransferSync] ${expiredCount} promoção(ões) expirada(s)`);

        const limiter = pLimit(3);
        const scraped = await Promise.all(
            TRANSFER_SOURCES.map(source => limiter(() => scrapeTransferSource(source)))
        );
        validScraped = scraped.filter(Boolean);
        console.log(`[TransferSync] Scraped ${validScraped.length}/${TRANSFER_SOURCES.length} fontes`);

        _syncState.step = 'analyzing';
        const analysis = await analyzeTransferDataWithClaude(validScraped, current);
        console.log(`[TransferSync] Claude: changes_detected=${analysis.changes_detected}`);
        console.log(`[TransferSync] Resumo: ${analysis.summary}`);

        _syncState.step = 'updating';

        if (analysis.changes_detected && Array.isArray(analysis.promotions)) {
            for (const promo of analysis.promotions) {
                const cardId = promo.card_id ?? promo.cardId;
                const existing = current?.find(r => r.card_id === cardId && r.program === promo.program);

                if (!existing) {
                    if (!cardId || !promo.program) continue;
                    const newRow = {
                        card_id: cardId,
                        program: promo.program,
                        bonus_percent: promo.bonus_percent ?? promo.bonusPercent ?? 0,
                        club_bonus_percent: promo.club_bonus_percent ?? promo.clubBonusPercent ?? 0,
                        club_tier_bonuses: promo.club_tier_bonuses ?? promo.clubTierBonuses ?? {},
                        valid_until: promo.valid_until ?? promo.validUntil ?? '',
                        description: promo.description ?? '',
                        is_periodic: promo.is_periodic ?? promo.isPeriodic ?? true,
                        last_confirmed: promo.last_confirmed ?? promo.lastConfirmed ?? new Date().toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }),
                        rules: promo.rules ?? [],
                        club_required: promo.club_required ?? promo.clubRequired ?? null,
                        base_ratio: promo.base_ratio ?? promo.baseRatio ?? null,
                        active: true,
                    };
                    const { error: insertErr } = await supabase.from('transfer_promotions').insert(newRow);
                    if (insertErr) console.error(`[TransferSync] Erro ao inserir ${cardId}→${promo.program}:`, insertErr.message);
                    else {
                        updatedCount++;
                        allDiffs.push({ card_id: cardId, program: promo.program, action: 'insert' });
                        console.log(`[TransferSync] Nova promoção: ${cardId}→${promo.program}`);
                    }
                    continue;
                }

                const updates = {
                    bonus_percent: promo.bonus_percent ?? promo.bonusPercent ?? existing.bonus_percent,
                    club_bonus_percent: promo.club_bonus_percent ?? promo.clubBonusPercent ?? existing.club_bonus_percent,
                    club_tier_bonuses: promo.club_tier_bonuses ?? promo.clubTierBonuses ?? existing.club_tier_bonuses,
                    valid_until: promo.valid_until ?? promo.validUntil ?? existing.valid_until,
                    description: promo.description ?? existing.description,
                    is_periodic: promo.is_periodic ?? promo.isPeriodic ?? existing.is_periodic,
                    last_confirmed: promo.last_confirmed ?? promo.lastConfirmed ?? existing.last_confirmed,
                    rules: promo.rules ?? existing.rules,
                    base_ratio: promo.base_ratio ?? promo.baseRatio ?? existing.base_ratio ?? null,
                    updated_at: new Date().toISOString(),
                };

                // Compute field-level diff for log
                const fieldDiff = {};
                for (const field of ['bonus_percent', 'club_bonus_percent', 'valid_until']) {
                    if (updates[field] !== undefined && String(updates[field]) !== String(existing[field])) {
                        fieldDiff[field] = { from: existing[field], to: updates[field] };
                    }
                }
                if (Object.keys(fieldDiff).length > 0) {
                    allDiffs.push({ card_id: cardId, program: promo.program, action: 'update', diff: fieldDiff });
                }

                const { error: updateErr } = await supabase
                    .from('transfer_promotions').update(updates).eq('id', existing.id);
                if (updateErr) console.error(`[TransferSync] Erro ao atualizar ${cardId}→${promo.program}:`, updateErr.message);
                else updatedCount++;
            }
        }

        if (analysis.changes_detected) {
            resetPromotionsCacheAt();
            await refreshPromotionsCache();
        }

        console.log(`[TransferSync] Concluído. Atualizadas: ${updatedCount} promoções`);

        const diffsText = allDiffs.length > 0
            ? '\n\nMUDANÇAS:\n' + allDiffs.map(d => {
                if (d.action === 'insert') return `+ ${d.card_id} → ${d.program} (nova)`;
                const fields = Object.entries(d.diff).map(([k, v]) => `${k}: ${v.from} → ${v.to}`).join(', ');
                return `~ ${d.card_id} → ${d.program}: ${fields}`;
            }).join('\n')
            : '';

        const { error: logErr } = await supabase.from('transfer_sync_log').insert({
            synced_at: startedAt,
            sources_scraped: validScraped.length,
            changes_detected: analysis.changes_detected ?? false,
            rows_updated: updatedCount,
            summary: (analysis.summary ?? '') + diffsText,
        });
        if (logErr) console.error('[TransferSync] Erro ao salvar log:', logErr.message);

        // Processa ai_summary para promoções novas inseridas pelo scraper nesta rodada
        processPromoSummaries().catch(err => console.warn('[PromoSummary] Erro pós-sync:', err.message));

        const result = { sourcesScraped: validScraped.length, changesDetected: analysis.changes_detected, rowsUpdated: updatedCount, summary: analysis.summary, diffs: allDiffs };
        _syncState = { inProgress: false, step: 'done', startedAt, lastResult: result };
        return result;

    } catch (err) {
        console.error('[TransferSync] ERRO:', err.message);
        _syncState = { inProgress: false, step: 'error', startedAt, lastResult: { error: err.message } };
        await supabase.from('transfer_sync_log').insert({
            synced_at: startedAt,
            sources_scraped: validScraped.length,
            changes_detected: false,
            rows_updated: 0,
            summary: `ERRO: ${err.message}`,
        }).catch(() => {});
        throw err;
    }
}

// ── Processa ai_summary para promoções novas (Haiku, uma vez por promo) ───────

async function processPromoSummaries() {
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey || !supabase) return { processed: 0, errors: 0 };

    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    const { data: promos, error } = await supabase
        .from('promocoes')
        .select('id, titulo, conteudo')
        .is('ai_processed_at', null)
        .gt('created_at', tenDaysAgo)
        .order('created_at', { ascending: false })
        .limit(30);

    if (error || !promos || promos.length === 0) return { processed: 0, errors: 0 };

    console.log(`[PromoSummary] Processando ${promos.length} promoções com Haiku...`);
    let processed = 0;
    let errors = 0;
    const limiter = pLimit(3);

    await Promise.all(promos.map(promo => limiter(async () => {
        try {
            const text = [promo.titulo, promo.conteudo].filter(Boolean).join('\n').slice(0, 1500);
            const res = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'x-api-key': anthropicKey,
                    'anthropic-version': '2023-06-01',
                    'content-type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'claude-haiku-4-5-20251001',
                    max_tokens: 120,
                    system: 'Responda SOMENTE com o texto do resumo solicitado. Sem explicações, sem aspas, sem markdown.',
                    messages: [{
                        role: 'user',
                        content: `Extraia um resumo compacto (máximo 200 caracteres) em português desta promoção de milhas com os fatos mais importantes para quem quer usar: ratio de transferência (se mencionado, ex: "1:1"), mínimo de pontos, se precisa de cadastro/ativação, prazo limite e condições especiais. Omita o que não estiver no texto.\n\nTexto: ${text}`,
                    }],
                }),
                signal: AbortSignal.timeout(12000),
            });
            if (!res.ok) { errors++; return; }
            const data = await res.json();
            const summary = data.content?.[0]?.text?.trim();
            if (!summary) { errors++; return; }
            await supabase.from('promocoes').update({
                ai_summary: summary.slice(0, 220),
                ai_processed_at: new Date().toISOString(),
            }).eq('id', promo.id);
            processed++;
        } catch {
            errors++;
        }
    })));

    console.log(`[PromoSummary] Concluído: ${processed} processadas, ${errors} erros`);
    return { processed, errors };
}

// ── Routes ────────────────────────────────────────────────────────────────────

router.get('/api/admin/transfer-sync-status', requireSyncSecret, (_req, res) => {
    res.json(_syncState);
});

router.post('/api/admin/sync-transfer-data', requireSyncSecret, async (req, res) => {
    if (_syncState.inProgress) {
        return res.status(409).json({ message: 'Sync já em andamento', state: _syncState });
    }
    res.json({ message: 'Sync iniciado em background' });
    syncTransferData().catch(err => console.error('[TransferSync] Erro:', err.message));
});

router.post('/api/admin/sync-transfer-data-sync', requireSyncSecret, async (req, res) => {
    try {
        const result = await syncTransferData();
        res.json({ ok: true, result });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message, stack: err.stack?.split('\n').slice(0, 5) });

    }
});

router.post('/api/admin/process-promo-summaries', requireSyncSecret, async (req, res) => {
    try {
        const result = await processPromoSummaries();
        res.json({ ok: true, ...result });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

router.get('/api/admin/test-anthropic', async (_req, res) => {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) return res.status(500).json({ error: 'ANTHROPIC_API_KEY não configurada' });
    try {
        const r = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
            body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 64, messages: [{ role: 'user', content: 'Diga apenas: OK' }] }),
            signal: AbortSignal.timeout(30000),
        });
        const body = await r.json();
        res.json({ status: r.status, body });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/api/admin/transfer-sync-diag', async (_req, res) => {
    const diag = {
        anthropic_key_set: !!process.env.ANTHROPIC_API_KEY,
        supabase_service_role_set: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        supabase_anon_set: !!process.env.VITE_SUPABASE_ANON_KEY,
        supabase_client: !!supabase,
        write_test: null,
        read_test: null,
    };

    if (supabase) {
        const { data: rd, error: re } = await supabase.from('transfer_promotions').select('id').limit(1);
        diag.read_test = re ? `ERRO: ${re.message}` : `OK (${rd?.length ?? 0} rows)`;
        const { error: we } = await supabase.from('transfer_sync_log').insert({
            synced_at: new Date().toISOString(),
            sources_scraped: 0,
            changes_detected: false,
            rows_updated: 0,
            summary: 'DIAGNÓSTICO — teste de escrita',
        });
        diag.write_test = we ? `ERRO: ${we.message}` : 'OK';
    }

    res.json(diag);
});

router.get('/api/admin/transfer-sync-log', requireSyncSecret, async (req, res) => {
    if (!supabase) return res.json({ logs: [] });
    const { data } = await supabase
        .from('transfer_sync_log')
        .select('*')
        .order('synced_at', { ascending: false })
        .limit(30);
    res.json({ logs: data ?? [] });
});

router.get('/api/admin/stats', requireAdminJWT, async (_req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase indisponível' });
    try {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

        const [usersRes, planCountsRes, strategiesMonthRes, roteiroMonthRes, buscasMonthRes] = await Promise.all([
            supabase.from('user_profiles').select('id', { count: 'exact', head: true }),
            supabase.from('user_profiles').select('plan'),
            supabase.from('strategies').select('id', { count: 'exact', head: true }).gte('created_at', monthStart),
            supabase.from('itineraries').select('id', { count: 'exact', head: true }).gte('created_at', monthStart),
            supabase.from('buscas').select('id', { count: 'exact', head: true }).gte('created_at', monthStart),
        ]);

        const planCounts = { free: 0, essencial: 0, pro: 0, elite: 0, admin: 0 };
        for (const row of planCountsRes.data ?? []) {
            const p = row.plan ?? 'free';
            planCounts[p] = (planCounts[p] ?? 0) + 1;
        }

        res.json({
            totalUsers: usersRes.count ?? 0,
            planCounts,
            strategiesThisMonth: strategiesMonthRes.count ?? 0,
            roteiroThisMonth: roteiroMonthRes.count ?? 0,
            buscasThisMonth: buscasMonthRes.count ?? 0,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/api/admin/users', requireAdminJWT, async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase indisponível' });
    try {
        const plan = req.query.plan ?? null;
        const search = req.query.search ?? null;
        const page = parseInt(req.query.page ?? '1', 10);
        const pageSize = 20;
        const offset = (page - 1) * pageSize;

        let query = supabase
            .from('user_profiles')
            .select('id, full_name, plan, plan_expires_at, plan_billing, is_admin, updated_at', { count: 'exact' })
            .order('updated_at', { ascending: false })
            .range(offset, offset + pageSize - 1);

        if (plan) query = query.eq('plan', plan);

        const { data, count, error } = await query;
        if (error) throw error;

        const ids = (data ?? []).map(u => u.id);
        let emailMap = {};
        if (ids.length > 0) {
            const { data: authUsers } = await supabase.auth.admin.listUsers({ perPage: 1000 });
            for (const au of authUsers?.users ?? []) {
                emailMap[au.id] = au.email;
            }
        }

        let users = (data ?? []).map(u => ({ ...u, email: emailMap[u.id] ?? null }));
        if (search) {
            const s = search.toLowerCase();
            users = users.filter(u =>
                u.full_name?.toLowerCase().includes(s) ||
                u.email?.toLowerCase().includes(s)
            );
        }

        res.json({ users, total: count ?? 0, page, pageSize });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.patch('/api/admin/users/:id/plan', requireAdminJWT, async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase indisponível' });
    const { id } = req.params;
    const { plan, plan_expires_at, plan_billing } = req.body;

    const allowed = ['free', 'essencial', 'pro', 'elite', 'admin'];
    if (plan && !allowed.includes(plan)) return res.status(400).json({ error: 'Plano inválido' });

    try {
        const update = {};
        if (plan !== undefined) update.plan = plan;
        if (plan_expires_at !== undefined) update.plan_expires_at = plan_expires_at;
        if (plan_billing !== undefined) update.plan_billing = plan_billing;
        const { error } = await supabase.from('user_profiles').update(update).eq('id', id);
        if (error) throw error;
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/admin/users/:id/toggle-admin', requireAdminJWT, async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase indisponível' });
    const { id } = req.params;
    const { is_admin } = req.body;
    if (typeof is_admin !== 'boolean') return res.status(400).json({ error: 'is_admin deve ser boolean' });

    try {
        const { error } = await supabase.from('user_profiles').update({ is_admin }).eq('id', id);
        if (error) throw error;
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PLAN_PRICES = {
    essencial: { mensal: 19, anual: 12 },
    pro:       { mensal: 39, anual: 25 },
    elite:     { mensal: 69, anual: 45 },
};

router.get('/api/admin/revenue', requireAdminJWT, async (_req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase indisponível' });
    try {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const in7days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

        const { data: profiles } = await supabase
            .from('user_profiles')
            .select('id, plan, plan_expires_at, plan_billing');

        let mrr = 0;
        let churnCount = 0;
        const expiringUsers = [];

        for (const p of profiles ?? []) {
            const isExpired = p.plan_expires_at && new Date(p.plan_expires_at) < now;
            const isPaid = ['essencial', 'pro', 'elite'].includes(p.plan);
            const prices = PLAN_PRICES[p.plan];

            if (isPaid && !isExpired && prices) {
                mrr += p.plan_billing === 'anual' ? prices.anual : prices.mensal;
            }
            if (isPaid && isExpired) churnCount++;
            if (p.plan_expires_at && !isExpired && new Date(p.plan_expires_at) <= new Date(in7days) && isPaid) {
                expiringUsers.push({ id: p.id, plan: p.plan, plan_expires_at: p.plan_expires_at });
            }
        }

        const { count: newPaidThisMonth } = await supabase
            .from('user_profiles')
            .select('id', { count: 'exact', head: true })
            .in('plan', ['essencial', 'pro', 'elite'])
            .gte('updated_at', monthStart);

        const total = profiles?.length ?? 0;
        const paid = (profiles ?? []).filter(p => {
            const isExpired = p.plan_expires_at && new Date(p.plan_expires_at) < now;
            return ['essencial', 'pro', 'elite'].includes(p.plan) && !isExpired;
        }).length;

        res.json({
            mrr,
            conversionRate: total > 0 ? ((paid / total) * 100).toFixed(1) : '0',
            paidUsers: paid,
            churnCount,
            newPaidThisMonth: newPaidThisMonth ?? 0,
            expiringIn7Days: expiringUsers,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/api/admin/engagement', requireAdminJWT, async (_req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase indisponível' });
    try {
        const now = new Date();
        const days30ago = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const days7ago  = new Date(now.getTime() -  7 * 24 * 60 * 60 * 1000).toISOString();
        const days14ago = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();

        const { data: activeBuscas } = await supabase.from('buscas').select('user_id').gte('created_at', days30ago);
        const { data: activeBuscas7d } = await supabase.from('buscas').select('user_id').gte('created_at', days7ago);
        const activeUsers30d = new Set((activeBuscas ?? []).map(b => b.user_id)).size;
        const activeUsers7d  = new Set((activeBuscas7d ?? []).map(b => b.user_id)).size;

        const { data: buscas30d } = await supabase.from('buscas').select('origem, destino').gte('created_at', days30ago);
        const routeCount = {};
        for (const b of buscas30d ?? []) {
            const key = `${b.origem} → ${b.destino}`;
            routeCount[key] = (routeCount[key] ?? 0) + 1;
        }
        const topRoutes = Object.entries(routeCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([route, count]) => ({ route, count }));

        const { data: strategies14d } = await supabase.from('strategies').select('created_at').gte('created_at', days14ago);
        const stratByDay = {};
        for (const s of strategies14d ?? []) {
            const day = s.created_at.slice(0, 10);
            stratByDay[day] = (stratByDay[day] ?? 0) + 1;
        }
        const strategiesPerDay = Object.entries(stratByDay)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([date, count]) => ({ date, count }));

        const { data: paidProfiles } = await supabase.from('user_profiles').select('id, plan, plan_expires_at').in('plan', ['essencial', 'pro', 'elite']);
        const activeIds = new Set((activeBuscas ?? []).map(b => b.user_id));
        const paidNow = new Date();
        const inactivePaid = (paidProfiles ?? []).filter(p => {
            const expired = p.plan_expires_at && new Date(p.plan_expires_at) < paidNow;
            return !expired && !activeIds.has(p.id);
        }).length;

        res.json({ activeUsers30d, activeUsers7d, inactivePaidUsers: inactivePaid, topRoutes, strategiesPerDay });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/api/admin/api-status', requireAdminJWT, async (_req, res) => {
    const { SEATS_AERO_API_KEY, SEATS_AERO_BASE } = await import('../lib/seatsAero.js');

    async function check(name, fn) {
        const start = Date.now();
        try { await fn(); return { name, ok: true, latency: Date.now() - start }; }
        catch (e) { return { name, ok: false, latency: Date.now() - start, error: e.message }; }
    }

    const results = await Promise.all([
        check('Supabase', async () => {
            if (!supabase) throw new Error('Client não inicializado');
            const { error } = await supabase.from('user_profiles').select('id').limit(1);
            if (error) throw error;
        }),
        check('Seats.aero', async () => {
            if (!SEATS_AERO_API_KEY) throw new Error('API key não configurada');
            const r = await fetch(`${SEATS_AERO_BASE}/availability?origin_airport=GRU&destination_airport=JFK&cabin=economy&start_date=2025-06-01&end_date=2025-06-30`, {
                headers: { 'Partner-Authorization': SEATS_AERO_API_KEY },
                signal: AbortSignal.timeout(8000),
            });
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
        }),
        check('Amadeus', async () => {
            const key = process.env.AMADEUS_CLIENT_ID;
            const secret = process.env.AMADEUS_CLIENT_SECRET;
            if (!key || !secret) throw new Error('Credenciais não configuradas');
            const r = await fetch('https://api.amadeus.com/v1/security/oauth2/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: `grant_type=client_credentials&client_id=${key}&client_secret=${secret}`,
                signal: AbortSignal.timeout(8000),
            });
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
        }),
        check('Anthropic (Claude)', async () => {
            const key = process.env.ANTHROPIC_API_KEY;
            if (!key) throw new Error('API key não configurada');
            const r = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
                body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 8, messages: [{ role: 'user', content: 'OK' }] }),
                signal: AbortSignal.timeout(15000),
            });
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
        }),
        check('AbacatePay', async () => {
            const key = process.env.ABACATEPAY_API_KEY;
            if (!key) throw new Error('API key não configurada');
            const r = await fetch('https://api.abacatepay.com/v1/billing/list', {
                headers: { Authorization: `Bearer ${key}` },
                signal: AbortSignal.timeout(8000),
            });
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
        }),
    ]);

    res.json({ checks: results, checkedAt: new Date().toISOString() });
});

router.get('/api/admin/costs', requireAdminJWT, async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase indisponível' });
    try {
        const month = req.query.month ?? new Date().toISOString().slice(0, 7);
        const monthStart = `${month}-01`;
        const [year, mon] = month.split('-').map(Number);
        const nextMonth = mon === 12
            ? `${year + 1}-01-01`
            : `${year}-${String(mon + 1).padStart(2, '0')}-01`;
        const { data, error } = await supabase
            .from('admin_costs')
            .select('*')
            .gte('month', monthStart)
            .lt('month', nextMonth)
            .order('category')
            .order('service');
        if (error) throw error;
        res.json({ costs: data ?? [] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/api/admin/costs/history', requireAdminJWT, async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase indisponível' });
    try {
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
        sixMonthsAgo.setDate(1);
        const { data, error } = await supabase
            .from('admin_costs')
            .select('month, amount_brl')
            .gte('month', sixMonthsAgo.toISOString().slice(0, 10))
            .order('month');
        if (error) throw error;
        const byMonth = {};
        for (const row of data ?? []) {
            const m = row.month.slice(0, 7);
            byMonth[m] = (byMonth[m] ?? 0) + parseFloat(row.amount_brl);
        }
        res.json({ history: Object.entries(byMonth).map(([month, total]) => ({ month, total })) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/admin/costs', requireAdminJWT, async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase indisponível' });
    const { month, service, category, amount_brl, notes } = req.body;
    if (!month || !service || !category || amount_brl == null) {
        return res.status(400).json({ error: 'Campos obrigatórios: month, service, category, amount_brl' });
    }
    try {
        const { data, error } = await supabase
            .from('admin_costs')
            .insert({ month: `${month}-01`, service, category, amount_brl, notes: notes || null })
            .select()
            .single();
        if (error) throw error;
        res.json({ cost: data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/api/admin/costs/:id', requireAdminJWT, async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase indisponível' });
    try {
        const { error } = await supabase.from('admin_costs').delete().eq('id', req.params.id);
        if (error) throw error;
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Geração de posts para Instagram ──────────────────────────────────────────

function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildPostSlideHTML(slide, slideHeight = 1350) {
    const BG_MAP = { navy: '#0E2A55', white: '#FFFFFF', snow: '#F7F9FC', vibrant: '#2A60C2' };
    const bg      = BG_MAP[slide.background] ?? '#FFFFFF';
    const isDark  = slide.background === 'navy' || slide.background === 'vibrant';
    const isNavy  = slide.background === 'navy';

    const headlineRaw  = String(slide.headline ?? '');
    const headlineLen  = headlineRaw.replace(/\n/g, '').length;
    const headlineSize = slide.headlineSize > 0
        ? slide.headlineSize
        : headlineLen > 70 ? 58 : headlineLen > 50 ? 68 : headlineLen > 30 ? 78 : 88;
    const headlineHtml = escapeHtml(headlineRaw).replace(/\n/g, '<br>');
    const bodyHtml     = escapeHtml(String(slide.body ?? '')).replace(/\n/g, '<br>');

    const vPad = slideHeight === 1920 ? 110 : 80;
    const lPad = isDark ? 96 : 80;

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Manrope:wght@700;800;900&display=swap" rel="stylesheet">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: 1080px; height: ${slideHeight}px; overflow: hidden; }
body {
    background: ${bg};
    font-family: 'Inter', system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: ${vPad}px 80px ${vPad}px ${lPad}px;
}
.accent-bar { position: absolute; left: 0; top: ${vPad}px; bottom: ${vPad}px; width: 6px; background: linear-gradient(180deg, #4A90E2 0%, #2A60C2 60%, rgba(42,96,194,0) 100%); border-radius: 0 4px 4px 0; }
.progress-bar { position: absolute; top: 0; left: 0; right: 0; height: 5px; background: linear-gradient(90deg, #2A60C2 0%, #4A90E2 100%); }
.deco-ring { position: absolute; top: ${slideHeight === 1920 ? '-180px' : '-140px'}; right: -140px; width: ${slideHeight === 1920 ? '680px' : '580px'}; height: ${slideHeight === 1920 ? '680px' : '580px'}; border-radius: 50%; border: ${isDark ? '1px solid rgba(74,144,226,0.12)' : '1px solid rgba(42,96,194,0.06)'}; pointer-events: none; }
.deco-ring-2 { position: absolute; top: ${slideHeight === 1920 ? '-80px' : '-60px'}; right: -60px; width: ${slideHeight === 1920 ? '420px' : '360px'}; height: ${slideHeight === 1920 ? '420px' : '360px'}; border-radius: 50%; background: ${isNavy ? 'rgba(74,144,226,0.06)' : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(42,96,194,0.04)'}; pointer-events: none; }
.deco-dot-grid { position: absolute; bottom: 120px; right: 80px; width: 120px; height: 120px; background-image: radial-gradient(circle, ${isDark ? 'rgba(74,144,226,0.25)' : 'rgba(42,96,194,0.12)'} 1.5px, transparent 1.5px); background-size: 20px 20px; pointer-events: none; }
.tag { display: inline-flex; align-items: center; gap: 8px; margin-bottom: 28px; width: fit-content; }
.tag-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; background: ${isDark ? '#4A90E2' : '#2A60C2'}; }
.tag-label { font-size: 13px; font-weight: 700; letter-spacing: 0.13em; text-transform: uppercase; color: ${isDark ? '#4A90E2' : '#2A60C2'}; }
.headline { font-family: 'Manrope', sans-serif; font-size: ${headlineSize}px; font-weight: 900; line-height: 1.04; letter-spacing: -0.028em; color: ${isDark ? '#FFFFFF' : '#0E2A55'}; max-width: 920px; ${slide.body ? 'margin-bottom: 32px;' : ''} }
.body { font-size: ${slideHeight === 1920 ? '30px' : '27px'}; font-weight: 400; line-height: 1.72; color: ${isDark ? 'rgba(255,255,255,0.70)' : '#2C3E6B'}; max-width: 900px; }
.swipe-hint { margin-top: 48px; font-size: 17px; font-weight: 600; letter-spacing: 0.07em; color: ${isDark ? 'rgba(255,255,255,0.36)' : '#C8D4E8'}; text-transform: uppercase; }
.footer { position: absolute; bottom: ${slideHeight === 1920 ? '80px' : '52px'}; left: ${lPad}px; right: 80px; display: flex; justify-content: space-between; align-items: center; }
.logo { font-family: 'Manrope', sans-serif; font-size: 19px; font-weight: 900; letter-spacing: -0.01em; color: ${isDark ? 'rgba(255,255,255,0.85)' : '#0E2A55'}; display: flex; align-items: center; gap: 7px; }
.logo-dot { width: 9px; height: 9px; border-radius: 50%; background: ${isDark ? '#4A90E2' : '#2A60C2'}; }
.handle { font-size: 14px; font-weight: 500; letter-spacing: 0.03em; color: ${isDark ? 'rgba(255,255,255,0.28)' : '#C8D4E8'}; }
</style>
</head>
<body>
    ${isDark ? '<div class="accent-bar"></div>' : '<div class="progress-bar"></div>'}
    <div class="deco-ring"></div>
    <div class="deco-ring-2"></div>
    <div class="deco-dot-grid"></div>
    ${slide.tag ? `<div class="tag"><div class="tag-dot"></div><div class="tag-label">${escapeHtml(slide.tag)}</div></div>` : ''}
    <div class="headline">${headlineHtml}</div>
    ${slide.body ? `<div class="body">${bodyHtml}</div>` : ''}
    ${slide.swipeHint ? `<div class="swipe-hint">${escapeHtml(slide.swipeHint)}</div>` : ''}
    <div class="footer">
        <div class="logo"><div class="logo-dot"></div>FlyWise</div>
        <div class="handle">@flywisebr</div>
    </div>
</body>
</html>`;
}

router.post('/api/admin/generate-post-content', requireAdminJWT, async (req, res) => {
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) return res.status(503).json({ error: 'ANTHROPIC_API_KEY não configurada' });

    const { format = 'carrossel', pilar = 'estrategia', topic = '', dayOfWeek } = req.body ?? {};

    const PILARES = {
        estrategia: 'Estratégia — ensina como usar milhas de forma inteligente (CPM, programas, transferências)',
        produto:    'Produto — apresenta uma feature do FlyWise (busca, simulador, IA, roteiros)',
        inspiracao: 'Inspiração — destinos, experiências, motivação para acumular e viajar',
        prova:      'Prova — resultados reais, depoimentos, comparativos, cases de economia',
    };

    const FORMATOS = {
        carrossel: 'Carrossel de feed (5-6 slides): Slide 1 capa Navy com gancho + "arrasta →", slides 2-5 brancos/snow com 1 ideia cada, último slide CTA azul vibrant',
        isolado:   'Post isolado de feed (1 slide): único, fundo Navy ou Snow, headline forte, corpo resumido',
        story:     'Story (1-3 telas sequenciais): urgente, sem caption longo, fundo Navy ou vibrant',
    };

    const system = `Você é o criador de conteúdo do FlyWise — plataforma brasileira de viagens focada em otimização de milhas.

IDENTIDADE DA MARCA:
- Tom: educativo, estratégico, direto. Mais próximo de fintech do que portal de turismo.
- Linguagem: português brasileiro informal-profissional.
- Handle: @flywisebr
- Proposta de valor: a IA do FlyWise calcula automaticamente CPM, compara programas e recomenda a melhor estratégia para cada voo.

PRODUTO:
- Busca voos em BRL + disponibilidade de milhas (Seats.aero)
- IA que calcula CPM e recomenda Smiles, LATAM Pass, TudoAzul, Livelo etc.
- Simulador de transferências com bonificações ativas
- Gerador de roteiros day-by-day
- Planos: Free / Essencial R$19/mês / Pro R$39/mês / Elite R$69/mês

REGRAS INVIOLÁVEIS:
- Feed: conteúdo evergreen. NUNCA use dados de mercado que mudam.
- Use exemplos numéricos hipotéticos e ilustrativos.
- CTA do último slide de carrossel: sempre "link na bio".
- Máximo 3 linhas de texto por slide interno.
- Use \\n para quebras de linha nos campos headline e body.

RETORNE SOMENTE JSON VÁLIDO:
{
  "slides": [{ "background": "navy|white|snow|vibrant", "tag": "string", "headline": "string", "headlineSize": 0, "body": "string", "swipeHint": "string" }],
  "caption": "caption completo com hashtags para o Instagram"
}`;

    const userPrompt = `Crie um ${FORMATOS[format] ?? FORMATOS.carrossel}.

PILAR: ${PILARES[pilar] ?? PILARES.estrategia}
${topic ? `TEMA/ÂNGULO SOLICITADO: ${topic}` : 'TEMA: escolha o mais relevante e acionável para o pilar'}
DIA DA SEMANA: ${dayOfWeek ?? 'Segunda-feira'}

Gere o conteúdo completo seguindo todas as regras de marca.`;

    try {
        const r = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
            body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 2048, system, messages: [{ role: 'user', content: userPrompt }] }),
            signal: AbortSignal.timeout(45000),
        });

        if (!r.ok) {
            const errBody = await r.text().catch(() => '');
            throw new Error(`Anthropic API error: ${r.status} — ${errBody.slice(0, 200)}`);
        }

        const { content } = await r.json();
        const raw = content?.[0]?.text ?? '';
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('Resposta da IA não contém JSON válido');
        res.json(JSON.parse(jsonMatch[0]));
    } catch (err) {
        console.error('[PostContent] Erro:', err.message);
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/admin/generate-post', requireAdminJWT, async (req, res) => {
    const { slides, postFormat = 'feed' } = req.body ?? {};
    if (!Array.isArray(slides) || slides.length === 0) {
        return res.status(400).json({ error: 'slides é obrigatório e deve ser um array não-vazio' });
    }
    if (slides.length > 7) {
        return res.status(400).json({ error: 'Máximo de 7 slides por post' });
    }

    const slideHeight = postFormat === 'story' ? 1920 : 1350;

    try {
        await ensureChromium();
        const browser = await getBrowser();
        const context = await browser.newContext({
            viewport: { width: 1080, height: slideHeight },
            deviceScaleFactor: 1,
        });

        const images = [];
        for (let i = 0; i < slides.length; i++) {
            const page = await context.newPage();
            try {
                const html = buildPostSlideHTML(slides[i], slideHeight);
                await page.setContent(html, { waitUntil: 'domcontentloaded' });
                await page.evaluate(() => document.fonts.ready);
                await new Promise(r => setTimeout(r, 150));
                const buffer = await page.screenshot({ type: 'png', fullPage: false });
                images.push({
                    name: `flywise-slide-${String(i + 1).padStart(2, '0')}.png`,
                    data: buffer.toString('base64'),
                });
            } finally {
                await page.close().catch(() => {});
            }
        }

        await context.close().catch(() => {});
        res.json({ images });
    } catch (err) {
        console.error('[PostGen] Erro ao gerar slides:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ─── Referral codes ──────────────────────────────────────────────────────────

function generateReferralCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let suffix = '';
    for (let i = 0; i < 5; i++) suffix += chars[Math.floor(Math.random() * chars.length)];
    return `FW-${suffix}`;
}

router.get('/api/admin/referral-codes', requireAdminJWT, async (_req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase indisponível' });
    try {
        const { data: codes, error } = await supabase
            .from('referral_codes')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;

        const { data: signups, error: signupsErr } = await supabase
            .from('user_profiles')
            .select('referral_code_used, plan')
            .not('referral_code_used', 'is', null);
        if (signupsErr) throw signupsErr;

        const stats = {};
        for (const row of signups ?? []) {
            const code = row.referral_code_used;
            if (!stats[code]) stats[code] = { signups: 0, paying: 0, planBreakdown: {} };
            stats[code].signups += 1;
            const plan = row.plan ?? 'free';
            stats[code].planBreakdown[plan] = (stats[code].planBreakdown[plan] ?? 0) + 1;
            if (plan !== 'free') stats[code].paying += 1;
        }

        const enriched = (codes ?? []).map(c => ({
            ...c,
            signups_count: stats[c.code]?.signups ?? 0,
            paying_count:  stats[c.code]?.paying  ?? 0,
            plan_breakdown: stats[c.code]?.planBreakdown ?? {},
        }));

        res.json({ codes: enriched });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/admin/referral-codes', requireAdminJWT, async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase indisponível' });
    try {
        const { owner_name, owner_contact, notes } = req.body ?? {};
        if (!owner_name?.trim()) return res.status(400).json({ error: 'Nome do divulgador é obrigatório' });

        let code = null;
        for (let attempt = 0; attempt < 5; attempt++) {
            const candidate = generateReferralCode();
            const { data: exists } = await supabase
                .from('referral_codes')
                .select('id')
                .eq('code', candidate)
                .maybeSingle();
            if (!exists) { code = candidate; break; }
        }
        if (!code) return res.status(500).json({ error: 'Não foi possível gerar código único' });

        const { data, error } = await supabase
            .from('referral_codes')
            .insert({
                code,
                owner_name: owner_name.trim(),
                owner_contact: owner_contact?.trim() || null,
                notes: notes?.trim() || null,
            })
            .select()
            .single();
        if (error) throw error;

        res.json({ code: data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.patch('/api/admin/referral-codes/:id', requireAdminJWT, async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase indisponível' });
    try {
        const id = parseInt(req.params.id, 10);
        if (!Number.isFinite(id)) return res.status(400).json({ error: 'ID inválido' });

        const { owner_name, owner_contact, notes, active } = req.body ?? {};
        const patch = {};
        if (owner_name !== undefined)    patch.owner_name    = owner_name?.trim() || null;
        if (owner_contact !== undefined) patch.owner_contact = owner_contact?.trim() || null;
        if (notes !== undefined)         patch.notes         = notes?.trim() || null;
        if (active !== undefined)        patch.active        = !!active;

        if (Object.keys(patch).length === 0) return res.status(400).json({ error: 'Nada para atualizar' });

        const { data, error } = await supabase
            .from('referral_codes')
            .update(patch)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;

        res.json({ code: data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/api/admin/referral-codes/:id', requireAdminJWT, async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase indisponível' });
    try {
        const id = parseInt(req.params.id, 10);
        if (!Number.isFinite(id)) return res.status(400).json({ error: 'ID inválido' });

        const { error } = await supabase.from('referral_codes').delete().eq('id', id);
        if (error) throw error;

        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/api/referral-codes/validate/:code', async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase indisponível' });
    try {
        const code = req.params.code?.trim().toUpperCase();
        if (!code) return res.status(400).json({ error: 'Código inválido' });

        const { data, error } = await supabase
            .from('referral_codes')
            .select('code, owner_name, active')
            .eq('code', code)
            .maybeSingle();
        if (error) throw error;

        if (!data || !data.active) return res.json({ valid: false });
        res.json({ valid: true, owner_name: data.owner_name });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── Usage stats (métricas de uso por usuário) ───────────────────────────────

router.get('/api/admin/usage-stats', requireAdminJWT, async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase indisponível' });
    try {
        const period = req.query.period ?? 'month'; // today | 7d | 30d | month | all
        const includeInactive = req.query.include_inactive === 'true';

        let sinceISO = null;
        const now = new Date();
        if (period === 'today') {
            const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            sinceISO = startOfDay.toISOString();
        } else if (period === '7d') {
            sinceISO = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        } else if (period === '30d') {
            sinceISO = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
        } else if (period === 'month') {
            sinceISO = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        }
        // 'all' deixa sinceISO null

        const buildBuscasQuery = () => {
            let q = supabase.from('buscas').select('user_id, created_at');
            if (sinceISO) q = q.gte('created_at', sinceISO);
            return q;
        };
        const buildItinerariesQuery = () => {
            let q = supabase.from('itineraries').select('user_id, created_at');
            if (sinceISO) q = q.gte('created_at', sinceISO);
            return q;
        };

        const [buscasRes, itinerariesRes, profilesRes] = await Promise.all([
            buildBuscasQuery(),
            buildItinerariesQuery(),
            supabase.from('user_profiles').select('id, full_name, email, plan'),
        ]);

        if (buscasRes.error) throw buscasRes.error;
        if (itinerariesRes.error) throw itinerariesRes.error;
        if (profilesRes.error) throw profilesRes.error;

        const usageMap = {};
        const ensureUser = (uid) => {
            if (!uid) return null;
            if (!usageMap[uid]) {
                usageMap[uid] = { user_id: uid, buscas_count: 0, roteiros_count: 0, last_activity: null };
            }
            return usageMap[uid];
        };

        const updateLastActivity = (entry, iso) => {
            if (!entry || !iso) return;
            if (!entry.last_activity || new Date(iso) > new Date(entry.last_activity)) {
                entry.last_activity = iso;
            }
        };

        for (const row of buscasRes.data ?? []) {
            const entry = ensureUser(row.user_id);
            if (entry) {
                entry.buscas_count += 1;
                updateLastActivity(entry, row.created_at);
            }
        }
        for (const row of itinerariesRes.data ?? []) {
            const entry = ensureUser(row.user_id);
            if (entry) {
                entry.roteiros_count += 1;
                updateLastActivity(entry, row.created_at);
            }
        }

        const profileMap = {};
        for (const p of profilesRes.data ?? []) profileMap[p.id] = p;

        const userIds = Object.keys(usageMap);

        if (includeInactive) {
            for (const p of profilesRes.data ?? []) {
                if (!usageMap[p.id]) {
                    usageMap[p.id] = { user_id: p.id, buscas_count: 0, roteiros_count: 0, last_activity: null };
                }
            }
        }

        const users = Object.values(usageMap)
            .map(entry => ({
                ...entry,
                full_name: profileMap[entry.user_id]?.full_name ?? null,
                email: profileMap[entry.user_id]?.email ?? null,
                plan: profileMap[entry.user_id]?.plan ?? 'free',
            }))
            .sort((a, b) => (b.buscas_count + b.roteiros_count) - (a.buscas_count + a.roteiros_count));

        const totals = {
            total_buscas: buscasRes.data?.length ?? 0,
            total_roteiros: itinerariesRes.data?.length ?? 0,
            active_users: userIds.length,
        };

        res.json({ period, totals, users });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
