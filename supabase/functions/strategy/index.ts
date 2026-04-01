// Supabase Edge Function: /strategy
// Runtime: Deno (Supabase Functions)
// Deploy: supabase functions deploy strategy
//
// Env vars required (Supabase Dashboard → Project Settings → Edge Functions → Secrets):
//   OPENAI_API_KEY   — your OpenAI key (GPT-4o-mini)
//   SUPABASE_URL     — automatically injected by Supabase
//   SUPABASE_SERVICE_ROLE_KEY — automatically injected by Supabase

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface FlightRow {
    id: number; companhia: string | null; preco_brl: number | null
    preco_milhas: number | null; taxas_brl: number | null; cpm: number | null
    partida: string | null; chegada: string | null
    origem: string | null; destino: string | null
    duracao_min: number | null; cabin_class: string | null
    segmentos: unknown; detalhes: unknown
}

interface PromoRow {
    titulo: string
    programa: string | null
    tipo: string | null
    bonus_pct: number | null
    parceiro: string | null
    valid_until: string | null
    // Scraper fields (migration 002 / run.py)
    subcategoria: string | null
    programas_tags: string[] | null
    categoria: string | null
}

interface UserData {
    miles: Record<string, number>
    cards: string[]
    clubs: string[]
    clubTiers: Record<string, string>
}

interface TransferPathDetail {
    source: string
    saldo_usuario: number
    ratio_base: number
    promo_bonus_pct: number
    ratio_efetivo: number
    milhas_resultantes: number
    custo_efetivo_por_mil: number
    promo_label: string | null
}

interface ProgramAnalysis {
    programa: string
    milhas_necessarias: number
    saldo_direto: number
    transferencias: TransferPathDetail[]
    total_potencial: number
    deficit: number
    custo_compra_milhas_brl: number
    promo_compra_ativa: string | null
    custo_efetivo_por_mil: number
    taxas_estimadas_brl: number
    custo_total_brl: number
    economia_vs_cash_brl: number
    economia_vs_cash_pct: number
    cpm: number
    melhor_opcao: boolean
    disponibilidade_confirmada: boolean
}

// ─── Static mappings ──────────────────────────────────────────────────────────

const AIRLINE_PROGRAMS: Record<string, string[]> = {
    'LA': ['LATAM Pass', 'Smiles', 'Livelo'],
    'JJ': ['LATAM Pass', 'Smiles', 'Livelo'],
    'G3': ['Smiles', 'Livelo'],
    'AD': ['TudoAzul', 'Livelo'],
    'AC': ['Smiles', 'Aeroplan', 'Livelo'],
    'AA': ['Smiles', 'AAdvantage', 'Livelo'],
    'UA': ['Smiles', 'MileagePlus', 'Livelo'],
    'DL': ['Smiles', 'SkyMiles', 'Livelo'],
    'TP': ['TAP Miles&Go', 'Smiles', 'Livelo'],
    'AF': ['Flying Blue', 'Smiles', 'Livelo'],
    'KL': ['Flying Blue', 'Smiles', 'Livelo'],
    'LH': ['Miles&More', 'Smiles', 'Livelo'],
    'AV': ['Lifemiles', 'Smiles', 'Livelo'],
    'CM': ['ConnectMiles', 'Smiles', 'Livelo'],
    'TK': ['Miles&Smiles', 'Smiles', 'Livelo'],
    'ET': ['ShebaMiles', 'Smiles'],
}

// Source programs that can transfer INTO each target loyalty program (base ratios, sem promos)
const TRANSFER_BASES: Record<string, Array<{ source: string; ratio: number }>> = {
    'Smiles': [
        { source: 'Livelo', ratio: 1.0 },
        { source: 'Pontos Itaú', ratio: 1.0 },
        { source: 'Esfera', ratio: 1.0 },
        { source: 'Membership Rewards', ratio: 1.5 },
        { source: 'Diners Club', ratio: 1.5 },
        { source: 'C6 Bank', ratio: 1.0 },
        { source: 'Inter Milhas', ratio: 1.0 },
    ],
    'LATAM Pass': [
        { source: 'Livelo', ratio: 1.0 },
        { source: 'Pontos Itaú', ratio: 1.0 },
        { source: 'Esfera', ratio: 1.0 },
        { source: 'Membership Rewards', ratio: 1.0 },
        { source: 'Diners Club', ratio: 1.0 },
        { source: 'C6 Bank', ratio: 1.0 },
    ],
    'TudoAzul': [
        { source: 'Livelo', ratio: 1.0 },
        { source: 'Pontos Itaú', ratio: 1.0 },
        { source: 'Esfera', ratio: 1.0 },
        { source: 'C6 Bank', ratio: 1.0 },
        { source: 'Inter Milhas', ratio: 1.0 },
    ],
    'Flying Blue': [
        { source: 'Livelo', ratio: 1.0 },
        { source: 'Membership Rewards', ratio: 1.0 },
    ],
    'Miles&More': [
        { source: 'Livelo', ratio: 1.0 },
        { source: 'Membership Rewards', ratio: 1.0 },
    ],
    'Lifemiles': [
        { source: 'Livelo', ratio: 1.0 },
        { source: 'Membership Rewards', ratio: 1.0 },
    ],
    'TAP Miles&Go': [
        { source: 'Livelo', ratio: 1.0 },
    ],
    'Aeroplan': [
        { source: 'Membership Rewards', ratio: 1.0 },
    ],
    'AAdvantage': [
        { source: 'Membership Rewards', ratio: 1.0 },
    ],
    'MileagePlus': [
        { source: 'Membership Rewards', ratio: 1.0 },
    ],
    // Programas internacionais acessíveis via Livelo (Turkish, Copa, Ethiopian via parcerias)
    'Miles&Smiles': [
        { source: 'Livelo', ratio: 1.0 },
    ],
    'ConnectMiles': [
        { source: 'Livelo', ratio: 1.0 },
    ],
    'ShebaMiles': [
        { source: 'Livelo', ratio: 1.0 },
    ],
    'SkyMiles': [
        { source: 'Membership Rewards', ratio: 1.0 },
    ],
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractIata(companhia: string | null): string {
    if (!companhia) return ''
    const m = companhia.match(/\(([A-Z]{2,3})\)/)
    if (m) return m[1]
    if (/^[A-Z]{2,3}$/.test(companhia.trim())) return companhia.trim()
    return ''
}

function formatMins(mins: number | null): string {
    if (!mins) return ''
    return `${Math.floor(mins / 60)}h${mins % 60 > 0 ? `${mins % 60}min` : ''}`
}

// Fuzzy balance lookup — handles "Smiles" ↔ "Smiles Clube", "LATAM" ↔ "LATAM Pass" etc.
function findBalance(miles: Record<string, number>, programName: string): number {
    const target = programName.toLowerCase().trim()
    for (const [prog, pts] of Object.entries(miles)) {
        const p = prog.toLowerCase().trim()
        if (p === target) return pts
        const targetFirst = target.split(' ')[0]
        const progFirst = p.split(' ')[0]
        if (targetFirst.length >= 4 && (p.startsWith(targetFirst) || target.startsWith(progFirst))) return pts
    }
    return 0
}

// ─── Flight string ─────────────────────────────────────────────────────────────

function buildFlightString(f: FlightRow, targetProgram: string): string {
    const det = (f.detalhes as Record<string, unknown>) ?? {}
    const iata = extractIata(f.companhia)
    const programs = (AIRLINE_PROGRAMS[iata] ?? ['Livelo']).slice(0, 5).join(', ')
    const lines = [
        `Rota: ${f.origem ?? '?'} → ${f.destino ?? '?'} | ${f.companhia ?? iata} (${iata})`,
        `Preço cash: R$ ${f.preco_brl?.toLocaleString('pt-BR') ?? 'N/A'} | Cabine: ${f.cabin_class ?? 'economy'} | Paradas: ${(det.paradas as number) ?? 0} | Duração: ${formatMins(f.duracao_min)}`,
        `Programas aceitos: ${programs}`,
        `Programa selecionado pelo usuário: ${targetProgram}`,
    ]
    if (f.partida) lines.push(`Ida: ${f.partida.slice(11, 16)} → ${f.chegada?.slice(11, 16) ?? ''}`)
    if (det.returnPartida) lines.push(`Volta: ${(det.returnPartida as string).slice(11, 16)} → ${(det.returnChegada as string | undefined ?? '').slice(11, 16)}`)
    return lines.join('\n')
}

// ─── Promo helpers ────────────────────────────────────────────────────────────

// Normaliza o tipo: promos do scraper usam subcategoria; promos manuais usam tipo.
function resolvePromoType(p: PromoRow): string {
    if (p.tipo) return p.tipo
    if (p.subcategoria === 'transferencia') return 'bonus_transferencia'
    if (p.subcategoria === 'clube') return 'clube'
    return 'outros'
}

// Verifica se uma promo é do programa alvo — checa tanto campo `programa` quanto `programas_tags`.
function promoMatchesProgram(p: PromoRow, programName: string): boolean {
    const target = programName.toLowerCase()
    if (p.programa?.toLowerCase() === target) return true
    return (p.programas_tags ?? []).some(t => t.toLowerCase() === target)
}

// Extrai percentual de bônus do título quando bonus_pct está NULL (promos do scraper).
function extractBonusFromTitle(titulo: string | null): number {
    if (!titulo) return 0
    const m = titulo.match(/\+?\s*(\d{2,3})\s*%/)
    return m ? parseInt(m[1], 10) : 0
}

// Retorna o bônus efetivo: usa bonus_pct quando disponível, senão extrai do título.
function effectiveBonus(p: PromoRow): number {
    return p.bonus_pct ?? extractBonusFromTitle(p.titulo)
}

// ─── Promo formatting ─────────────────────────────────────────────────────────

function formatPromoLine(p: PromoRow, i: number): string {
    const tipo = resolvePromoType(p)
    const tipoLabel = tipo === 'bonus_transferencia' ? '[transferência]'
        : tipo === 'clube' ? '[clube]'
        : tipo === 'boas_vindas' ? '[boas-vindas]'
        : tipo === 'milhas_compra' ? '[compra-milhas]'
        : '[promoção]'
    const bonus = effectiveBonus(p)
    // Programa: usa campo programa ou primeiro tag do scraper
    const programaLabel = p.programa ?? (p.programas_tags ?? []).filter(t => !['Nubank', 'Itaú', 'Livelo', 'C6', 'Inter', 'Santander', 'Bradesco'].includes(t))[0] ?? 'Geral'
    const parts = [`${i + 1}. ${tipoLabel} ${programaLabel}`]
    if (bonus > 0) parts.push(`+${bonus}% bônus`)
    if (p.parceiro) parts.push(`via ${p.parceiro}`)
    else if (p.programas_tags && p.programas_tags.length > 1) {
        // Para promos do scraper, o parceiro (banco) é o segundo tag
        const bancoTag = p.programas_tags.find(t => ['Nubank', 'Itaú', 'Livelo', 'C6', 'Inter', 'Santander', 'Bradesco', 'Amex', 'Caixa', 'BTG'].some(b => t.includes(b)))
        if (bancoTag) parts.push(`via ${bancoTag}`)
    }
    parts.push(`— ${String(p.titulo ?? '').slice(0, 80)}`)
    if (p.valid_until) parts.push(`(expira ${new Date(p.valid_until).toLocaleDateString('pt-BR')})`)
    return parts.join(' ')
}

// ─── Fetch promos ─────────────────────────────────────────────────────────────

async function fetchPromos(
    targetProgram: string,
    relatedPrograms: string[],
    sb: ReturnType<typeof createClient>
): Promise<{ promoStr: string; transferPromos: PromoRow[]; purchasePromos: PromoRow[] }> {
    try {
        const now = new Date().toISOString()
        const searchPrograms = Array.from(new Set([targetProgram, ...relatedPrograms])).filter(Boolean).slice(0, 7)
        const fallbackPrograms = searchPrograms.length > 0 ? searchPrograms : ['Smiles', 'LATAM Pass', 'Livelo']
        const PROMO_SELECT = 'titulo,programa,tipo,bonus_pct,parceiro,valid_until,subcategoria,programas_tags,categoria'
        const validFilter = 'valid_until.is.null,valid_until.gt.' + now

        // Query 1: promos manuais com campo `programa` preenchido (transferData / seeds)
        const q1 = sb.from('promocoes')
            .select(PROMO_SELECT)
            .or(validFilter)
            .in('programa', fallbackPrograms)
            .order('bonus_pct', { ascending: false, nullsFirst: false })
            .limit(15)

        // Query 2: promos do scraper RSS — usam `programas_tags` (array) ao invés de `programa`
        const q2 = sb.from('promocoes')
            .select(PROMO_SELECT)
            .or(validFilter)
            .overlaps('programas_tags', fallbackPrograms)
            .eq('categoria', 'milhas')
            .order('valid_until', { ascending: true, nullsFirst: false })
            .limit(15)

        const [{ data: d1 }, { data: d2 }] = await Promise.all([q1, q2])

        // Mescla e deduplica por título (evita duplicatas quando programa E programas_tags estão preenchidos)
        const seen = new Set<string>()
        const rows: PromoRow[] = []
        for (const row of [...(d1 ?? []), ...(d2 ?? [])]) {
            const key = String(row.titulo ?? '').slice(0, 60).toLowerCase()
            if (!seen.has(key)) { seen.add(key); rows.push(row as PromoRow) }
        }

        // Promos de transferência para o programa alvo (usadas na análise de cobertura)
        const transferPromos = rows.filter(p =>
            resolvePromoType(p) === 'bonus_transferencia' &&
            promoMatchesProgram(p, targetProgram)
        )

        // Mix balanceado para o prompt: transferências (3) + clube (1) + compra (1) + outros (1)
        const transfer = rows.filter(p => resolvePromoType(p) === 'bonus_transferencia').slice(0, 3)
        const clube = rows.filter(p => ['clube', 'boas_vindas'].includes(resolvePromoType(p))).slice(0, 1)
        const compra = rows.filter(p => resolvePromoType(p) === 'milhas_compra').slice(0, 1)
        const outros = rows.filter(p => !['bonus_transferencia', 'clube', 'boas_vindas', 'milhas_compra'].includes(resolvePromoType(p))).slice(0, 1)

        let selected = [...transfer, ...clube, ...compra, ...outros]

        // Fallback: qualquer promoção ativa se não achou nada para os programas do usuário
        if (selected.length === 0) {
            const { data: fallback } = await sb.from('promocoes')
                .select(PROMO_SELECT)
                .or(validFilter)
                .eq('categoria', 'milhas')
                .order('valid_until', { ascending: true, nullsFirst: false })
                .limit(5)
            selected = (fallback ?? []) as PromoRow[]
        }

        const promoStr = selected.length > 0
            ? selected.map(formatPromoLine).join('\n')
            : 'Nenhuma promoção ativa registrada para os programas relevantes.'

        // Promos de compra de milhas para o programa alvo (análise de déficit)
        const purchasePromos = rows.filter(p =>
            resolvePromoType(p) === 'milhas_compra' &&
            promoMatchesProgram(p, targetProgram)
        )

        return { promoStr, transferPromos, purchasePromos, allRows: rows }
    } catch (err) {
        console.error('[strategy] fetchPromos error:', err)
        return { promoStr: 'Nenhuma promoção disponível.', transferPromos: [], purchasePromos: [], allRows: [] }
    }
}

// ─── Club benefits ────────────────────────────────────────────────────────────

function getClubBenefits(club: string, tier: string | undefined): string {
    const combined = (club + ' ' + (tier ?? '')).toLowerCase()
    if (combined.includes('smiles')) {
        if (combined.includes('diamante')) return '10% desconto nas taxas de embarque + embarque prioritário'
        if (combined.includes('ouro')) return '5% desconto nas taxas de embarque'
        if (combined.includes('prata')) return '3% desconto nas taxas de embarque'
        return 'Clube Smiles ativo (benefícios dependem do tier)'
    }
    if (combined.includes('latam') || combined.includes('fidelidade')) {
        if (combined.includes('black')) return 'Upgrade disponível + embarque prioritário + bagagem extra'
        if (combined.includes('platinum')) return 'Embarque prioritário + bagagem extra'
        if (combined.includes('gold')) return 'Embarque prioritário'
        return 'Membro LATAM Fidelidade'
    }
    if (combined.includes('azul') || combined.includes('tudoazul')) {
        if (combined.includes('diamante')) return 'Embarque prioritário + 50% bônus em acúmulo'
        if (combined.includes('ouro')) return '30% bônus em acúmulo'
        return 'Membro TudoAzul ativo'
    }
    return 'Clube de fidelidade ativo'
}

// ─── Coverage analysis ────────────────────────────────────────────────────────

function buildCoverageSection(
    targetProgram: string,
    neededMiles: number,
    miles: Record<string, number>,
    cards: string[],
    clubs: string[],
    clubTiers: Record<string, string>,
    transferPromos: PromoRow[]
): { section: string; deficit: number } {
    if (neededMiles <= 0 || Object.keys(miles).length === 0) return { section: '', deficit: neededMiles }

    const directBalance = findBalance(miles, targetProgram)

    // Build transfer options for programs the user HAS
    const bases = TRANSFER_BASES[targetProgram] ?? []
    interface TransferOption {
        sourceProgram: string; sourceBalance: number
        effectiveRatio: number; yieldsPoints: number
        promoBonus: number; promoLabel: string | null
    }
    const transferOptions: TransferOption[] = []

    for (const base of bases) {
        const sourceBalance = findBalance(miles, base.source)
        if (sourceBalance <= 0) continue

        const sourceFirst = base.source.toLowerCase().split(' ')[0]
        const promo = transferPromos.find(p => {
            // Promos manuais: match por parceiro
            if (p.parceiro) {
                return base.source.toLowerCase().includes(p.parceiro.toLowerCase()) ||
                    p.parceiro.toLowerCase().includes(sourceFirst)
            }
            // Promos do scraper: match por programas_tags (contém banco + programa)
            return (p.programas_tags ?? []).some(tag => {
                const t = tag.toLowerCase()
                return base.source.toLowerCase().includes(t) || t.includes(sourceFirst)
            })
        })
        const promoBonus = promo ? effectiveBonus(promo) : 0
        const effectiveRatio = base.ratio * (1 + promoBonus / 100)
        const yieldsPoints = Math.floor(sourceBalance * effectiveRatio)

        transferOptions.push({
            sourceProgram: base.source,
            sourceBalance,
            effectiveRatio,
            yieldsPoints,
            promoBonus,
            promoLabel: promo
                ? `★ PROMO ATIVA +${promoBonus}% ${promo.parceiro ? `via ${promo.parceiro}` : `— ${String(promo.titulo ?? '').slice(0, 60)}`}${promo.valid_until ? ` (expira ${new Date(promo.valid_until).toLocaleDateString('pt-BR')})` : ''}`
                : null,
        })
    }

    const totalTransferable = transferOptions.reduce((s, t) => s + t.yieldsPoints, 0)
    const totalPotential = directBalance + totalTransferable
    const deficit = Math.max(0, neededMiles - totalPotential)
    const coversPct = neededMiles > 0 ? Math.min(100, Math.round(totalPotential * 100 / neededMiles)) : 0

    const lines: string[] = [
        `Programa alvo: ${targetProgram} | Necessário: ${neededMiles.toLocaleString('pt-BR')} pts`,
        '',
    ]

    lines.push('SALDO DIRETO:')
    if (directBalance > 0) {
        const pct = Math.round(directBalance * 100 / neededMiles)
        lines.push(`  ${targetProgram}: ${directBalance.toLocaleString('pt-BR')} pts (${pct}% do necessário)${directBalance >= neededMiles ? ' ✓ COBRE TUDO' : ''}`)
    } else {
        lines.push(`  ${targetProgram}: 0 pts (sem saldo neste programa)`)
    }

    if (transferOptions.length > 0) {
        lines.push('')
        lines.push('TRANSFERÊNCIAS DISPONÍVEIS (saldo do usuário):')
        for (const opt of transferOptions) {
            lines.push(`  ${opt.sourceProgram}: ${opt.sourceBalance.toLocaleString('pt-BR')} pts → ${targetProgram}`)
            if (opt.promoLabel) {
                lines.push(`    ${opt.promoLabel}`)
                lines.push(`    → Razão efetiva: ${opt.effectiveRatio.toFixed(2)}:1 → rende ${opt.yieldsPoints.toLocaleString('pt-BR')} pts ${targetProgram}`)
            } else {
                lines.push(`    → Razão base: ${opt.effectiveRatio.toFixed(1)}:1 → rende ${opt.yieldsPoints.toLocaleString('pt-BR')} pts (sem promo ativa)`)
            }
        }
    }

    lines.push('')
    if (totalPotential >= neededMiles) {
        lines.push(`POTENCIAL TOTAL: ${totalPotential.toLocaleString('pt-BR')} pts ✓ COBRE TUDO (sobra ${(totalPotential - neededMiles).toLocaleString('pt-BR')} pts)`)
        if (directBalance >= neededMiles) {
            lines.push(`→ Pode emitir usando APENAS o saldo direto de ${targetProgram}, sem nenhuma transferência.`)
        } else {
            const milesStillNeeded = neededMiles - directBalance
            const best = [...transferOptions].sort((a, b) => b.promoBonus - a.promoBonus || b.yieldsPoints - a.yieldsPoints)[0]
            if (best) {
                const rawNeeded = Math.ceil(milesStillNeeded / best.effectiveRatio)
                lines.push(`→ MÍNIMO: usar ${directBalance.toLocaleString('pt-BR')} ${targetProgram} direto + transferir ${rawNeeded.toLocaleString('pt-BR')} ${best.sourceProgram}${best.promoBonus > 0 ? ` (promo +${best.promoBonus}% → gera ${Math.floor(rawNeeded * best.effectiveRatio).toLocaleString('pt-BR')} pts)` : ''}`)
            }
        }
    } else {
        lines.push(`POTENCIAL TOTAL: ${totalPotential.toLocaleString('pt-BR')} pts — FALTAM ${deficit.toLocaleString('pt-BR')} pts (cobre apenas ${coversPct}%)`)
        lines.push(`→ Para completar o déficit: comprar milhas${transferOptions.some(t => t.promoBonus > 0) ? ' (verificar custo com promos ativas)' : ''} ou acumular nos programas transferíveis.`)
    }

    if (clubs.length > 0) {
        lines.push('')
        lines.push('CLUBES ATIVOS (benefícios para este voo):')
        for (const club of clubs) {
            const tier = clubTiers[club]
            lines.push(`  ${club}${tier ? ` (${tier})` : ''}: ${getClubBenefits(club, tier)}`)
        }
    }

    if (cards.length > 0) {
        lines.push(`\nCartões ativos: ${cards.slice(0, 5).join(', ')}`)
    }

    return { section: lines.join('\n'), deficit }
}

// ─── CPM analysis ─────────────────────────────────────────────────────────────

function buildCpmSection(cashPrice: number | null | undefined, totalMilhas: number): string {
    if (!cashPrice || cashPrice <= 0 || totalMilhas <= 0) return ''
    const cpm = (cashPrice * 100) / totalMilhas
    let avaliacao: string
    let recomendacao: string
    if (cpm >= 3.5) {
        avaliacao = 'EXCELENTE (≥ 3.5 c/pt)'
        recomendacao = '→ Vale muito a pena usar milhas. Economia excepcional.'
    } else if (cpm >= 2.5) {
        avaliacao = 'MUITO BOM (2.5–3.5 c/pt)'
        recomendacao = '→ Vale a pena usar milhas.'
    } else if (cpm >= 1.8) {
        avaliacao = 'BOM (1.8–2.5 c/pt)'
        recomendacao = '→ Vale a pena usar milhas.'
    } else if (cpm >= 1.2) {
        avaliacao = 'RAZOÁVEL (1.2–1.8 c/pt)'
        recomendacao = '→ Borderline: vale se o usuário tem muitas milhas sobrando no programa certo.'
    } else {
        avaliacao = 'RUIM (< 1.2 c/pt)'
        recomendacao = '→ ATENÇÃO: em dinheiro é mais vantajoso. Defina vale_a_pena: false.'
    }
    const economyEst = Math.round(cashPrice - totalMilhas * 0.0004)
    return [
        `CPM do resgate: ${cpm.toFixed(2)} c/pt  (R$ ${cashPrice.toLocaleString('pt-BR')} × 100 ÷ ${totalMilhas.toLocaleString('pt-BR')} milhas)`,
        `Avaliação: ${avaliacao}`,
        `Economia potencial bruta: ~R$ ${economyEst.toLocaleString('pt-BR')} (preço cash − taxas)`,
        recomendacao,
    ].join('\n')
}

// ─── Purchase analysis ────────────────────────────────────────────────────────

// Market price per 1.000 bank/credit-card points (R$) — for effective cost via transfer
const BANK_COST_PER_K: Record<string, number> = {
    'Livelo': 40,
    'Pontos Itaú': 38,
    'Esfera': 38,
    'Membership Rewards': 50,
    'Diners Club': 50,
    'C6 Bank': 38,
    'Inter Milhas': 38,
}

// Conservative estimated taxes per program (R$) — varies by route/cabin
const TAXES_BY_PROGRAM: Record<string, number> = {
    'Smiles': 100,
    'LATAM Pass': 450,
    'TudoAzul': 150,
    'Flying Blue': 200,
    'Miles&More': 250,
    'Lifemiles': 80,
    'TAP Miles&Go': 200,
    'Aeroplan': 150,
    'AAdvantage': 100,
    'MileagePlus': 100,
    'ShebaMiles': 80,
    'ConnectMiles': 100,
    'Miles&Smiles': 80,
    'SkyMiles': 100,
}

// Base market price per 1.000 pts (R$) in normal periods — promos often give 20-40% off
const BASE_COST_PER_K: Record<string, number> = {
    'Smiles': 42,
    'LATAM Pass': 50,
    'TudoAzul': 38,
    'Flying Blue': 60,
    'Miles&More': 65,
    'Lifemiles': 46,
    'TAP Miles&Go': 52,
    'Miles&Smiles': 55,
    'Aeroplan': 62,
    'AAdvantage': 55,
    'MileagePlus': 55,
}

// Purchase URLs per program (where users can buy miles directly)
const PROGRAM_PURCHASE_INFO: Record<string, { url: string; notes: string }> = {
    'Smiles':      { url: 'smiles.com.br/compre-milhas', notes: 'Promoções frequentes às quartas-feiras com até 40% de bônus' },
    'LATAM Pass':  { url: 'latampass.latam.com/pt_br/junte-milhas/compre-milhas', notes: 'Pacotes com bônus sazonais; verifique "Turbine"' },
    'TudoAzul':    { url: 'tudoazul.voeazul.com.br/compre-pontos', notes: 'Bônus em datas especiais e campanhas do Clube Azul' },
    'Lifemiles':   { url: 'lifemiles.com/shop/buy-miles', notes: 'Promoções frequentes de 30-125% de bônus' },
    'AAdvantage':  { url: 'aa.com/aadvantage/accrual/purchase-miles.do', notes: '' },
    'MileagePlus': { url: 'united.com/ual/pt/br/flight/mileageplus/buy-miles.html', notes: '' },
    'Flying Blue': { url: 'flyingblue.com/pt/miles/buy', notes: '' },
    'Miles&More':  { url: 'miles-and-more.com/miles/buy', notes: '' },
    'Aeroplan':    { url: 'aeroplan.com/en/earn-miles/buy', notes: '' },
}

// Transfer page URLs per program
const PROGRAM_TRANSFER_URLS: Record<string, string> = {
    'Smiles':      'smiles.com.br/acumule-milhas/transferencia-de-pontos',
    'LATAM Pass':  'latampass.latam.com/pt_br/junte-milhas/transfira-pontos',
    'TudoAzul':    'tudoazul.voeazul.com.br/acumule/transferencia-de-pontos',
    'Livelo':      'livelo.com.br/transferencia-de-pontos',
    'Flying Blue': 'flyingblue.com/en/earn-miles/partners/bank-partners',
}

// Maps card IDs (from userData.cards) to the bank transfer program they belong to
const CARD_TO_BANK_PROGRAM: Record<string, { bank: string; label: string }> = {
    'nubank_ultravioleta': { bank: 'Membership Rewards', label: 'Nubank Ultravioleta (via Amex)' },
    'amex_platinum':       { bank: 'Membership Rewards', label: 'Amex Platinum' },
    'amex_gold':           { bank: 'Membership Rewards', label: 'Amex Gold' },
    'amex_green':          { bank: 'Membership Rewards', label: 'Amex Green' },
    'iupp_itau':           { bank: 'Pontos Itaú', label: 'iupp Itaú' },
    'itau_personnalite':   { bank: 'Pontos Itaú', label: 'Itaú Personnalité' },
    'itau_uniclass':       { bank: 'Pontos Itaú', label: 'Itaú Uniclass' },
    'itau_grafite':        { bank: 'Pontos Itaú', label: 'Itaú Grafite' },
    'esfera_santander':    { bank: 'Esfera', label: 'Santander Esfera' },
    'santander_elite':     { bank: 'Esfera', label: 'Santander Elite' },
    'santander_black':     { bank: 'Esfera', label: 'Santander Black' },
    'c6_atomos':           { bank: 'C6 Bank', label: 'C6 Átomos' },
    'inter_black':         { bank: 'Inter Milhas', label: 'Banco Inter Black' },
    'inter_win':           { bank: 'Inter Milhas', label: 'Banco Inter Win' },
    'diners_global':       { bank: 'Diners Club', label: 'Diners Club Global' },
    'livelo_bradesco':     { bank: 'Livelo', label: 'Bradesco Livelo' },
    'livelo_bb':           { bank: 'Livelo', label: 'BB Livelo' },
    'caixa_mastercard':    { bank: 'Livelo', label: 'Caixa Mastercard' },
}

function buildPurchaseSection(
    targetProgram: string,
    deficitMiles: number,
    purchasePromos: PromoRow[],
    cashPrice: number | null | undefined
): string {
    if (deficitMiles <= 0) return ''

    const baseCostPerK = BASE_COST_PER_K[targetProgram] ?? 50
    const bestPromo = [...purchasePromos].sort((a, b) => (b.bonus_pct ?? 0) - (a.bonus_pct ?? 0))[0]
    const promoBonus = bestPromo?.bonus_pct ?? 0

    // With bonus: buy fewer base miles, receive more
    // To receive deficitMiles, buy ceil(deficitMiles / (1 + bonus/100))
    const milesToBuy = Math.ceil(deficitMiles / (1 + promoBonus / 100))
    const purchaseCost = Math.ceil(milesToBuy / 1000 * baseCostPerK)
    const effectiveCostPerK = promoBonus > 0
        ? Math.round(baseCostPerK / (1 + promoBonus / 100))
        : baseCostPerK

    const lines: string[] = [`Déficit: ${deficitMiles.toLocaleString('pt-BR')} pts | Programa: ${targetProgram}`, '']

    if (promoBonus > 0 && bestPromo) {
        const expiry = bestPromo.valid_until ? `, expira ${new Date(bestPromo.valid_until).toLocaleDateString('pt-BR')}` : ''
        lines.push(`★ PROMO DE COMPRA ATIVA: +${promoBonus}% bônus — ${String(bestPromo.titulo).slice(0, 60)}${expiry}`)
        lines.push(`  Custo efetivo: ~R$${effectiveCostPerK}/mil pts (base R$${baseCostPerK} com +${promoBonus}% de bônus)`)
        lines.push(`  Para cobrir déficit: comprar ${milesToBuy.toLocaleString('pt-BR')} pts base → recebe ${deficitMiles.toLocaleString('pt-BR')} pts → custo ~R$ ${purchaseCost.toLocaleString('pt-BR')}`)
    } else {
        lines.push(`Sem promo de compra ativa para ${targetProgram}.`)
        lines.push(`  Custo base de mercado: ~R$${baseCostPerK}/mil pts`)
        lines.push(`  Para cobrir déficit: ~R$ ${purchaseCost.toLocaleString('pt-BR')} (${deficitMiles.toLocaleString('pt-BR')} pts a preço normal)`)
    }

    if (cashPrice && cashPrice > 0) {
        const taxasEst = 80  // conservative estimate for taxes
        const totalWithPurchase = purchaseCost + taxasEst
        const savings = cashPrice - totalWithPurchase
        const savingsPct = Math.round(savings / cashPrice * 100)
        lines.push('')
        if (savings > 0) {
            lines.push(`Comparando com dinheiro (R$ ${cashPrice.toLocaleString('pt-BR')}):`)
            lines.push(`  Total com compra de milhas + taxas: ~R$ ${totalWithPurchase.toLocaleString('pt-BR')}`)
            lines.push(`  Economia: ~R$ ${savings.toLocaleString('pt-BR')} (${savingsPct}%)`)
            if (savingsPct >= 40) lines.push(`  → Comprar as milhas que faltam VALE MUITO A PENA.`)
            else if (savingsPct >= 20) lines.push(`  → Comprar as milhas que faltam é razoável.`)
            else lines.push(`  → Economia pequena comprando milhas; considere pagar em dinheiro diretamente.`)
        } else {
            lines.push(`→ ATENÇÃO: custo total comprando milhas (~R$ ${totalWithPurchase.toLocaleString('pt-BR')}) próximo ao preço em dinheiro (R$ ${cashPrice.toLocaleString('pt-BR')}). Dinheiro pode ser mais prático.`)
        }
    }

    const purchaseInfo = PROGRAM_PURCHASE_INFO[targetProgram]
    if (purchaseInfo) {
        lines.push('')
        lines.push(`ONDE COMPRAR: https://${purchaseInfo.url}`)
        if (purchaseInfo.notes) lines.push(`  Dica: ${purchaseInfo.notes}`)
    }

    return lines.join('\n')
}

// ─── Per-program analysis ─────────────────────────────────────────────────────

function analyzeProgram(
    programa: string,
    milhasNecessarias: number,
    userData: UserData | null,
    allPromos: PromoRow[],
    cashPrice: number | null | undefined,
    confirmedProgram: string | null
): ProgramAnalysis {
    const miles = userData?.miles ?? {}
    const saldoDireto = findBalance(miles, programa)

    const transferPromos = allPromos.filter(p =>
        resolvePromoType(p) === 'bonus_transferencia' &&
        promoMatchesProgram(p, programa)
    )

    const bases = TRANSFER_BASES[programa] ?? []
    const transferencias: TransferPathDetail[] = []

    for (const base of bases) {
        const saldoUsuario = findBalance(miles, base.source)
        if (saldoUsuario <= 0) continue

        const sourceFirst = base.source.toLowerCase().split(' ')[0]
        const promo = transferPromos.find(p => {
            if (p.parceiro) {
                return base.source.toLowerCase().includes(p.parceiro.toLowerCase()) ||
                    p.parceiro.toLowerCase().includes(sourceFirst)
            }
            return (p.programas_tags ?? []).some(tag => {
                const t = tag.toLowerCase()
                return base.source.toLowerCase().includes(t) || t.includes(sourceFirst)
            })
        })
        const promoBonus = promo ? effectiveBonus(promo) : 0
        const ratioEfetivo = base.ratio * (1 + promoBonus / 100)
        const milhasResultantes = Math.floor(saldoUsuario * ratioEfetivo)

        // Effective R$/1k destination miles if user were to BUY source points to transfer
        const sourceCostPerK = BANK_COST_PER_K[base.source] ?? BASE_COST_PER_K[base.source] ?? 45
        const custoEfetivoPorMil = Math.round(sourceCostPerK / ratioEfetivo)

        const promoLabel = promo
            ? `★ +${promoBonus}% ${promo.parceiro ? `via ${promo.parceiro}` : String(promo.titulo ?? '').slice(0, 50)}${promo.valid_until ? ` (expira ${new Date(promo.valid_until).toLocaleDateString('pt-BR')})` : ''}`
            : null

        transferencias.push({
            source: base.source,
            saldo_usuario: saldoUsuario,
            ratio_base: base.ratio,
            promo_bonus_pct: promoBonus,
            ratio_efetivo: ratioEfetivo,
            milhas_resultantes: milhasResultantes,
            custo_efetivo_por_mil: custoEfetivoPorMil,
            promo_label: promoLabel,
        })
    }

    const totalTransferivel = transferencias.reduce((s, t) => s + t.milhas_resultantes, 0)
    const totalPotencial = saldoDireto + totalTransferivel
    const deficit = Math.max(0, milhasNecessarias - totalPotencial)

    // Cost to buy deficit in the target program directly
    const baseCostPerK = BASE_COST_PER_K[programa] ?? 50
    const purchasePromos = allPromos.filter(p =>
        resolvePromoType(p) === 'milhas_compra' &&
        promoMatchesProgram(p, programa)
    )
    const bestPurchasePromo = [...purchasePromos].sort((a, b) => (b.bonus_pct ?? 0) - (a.bonus_pct ?? 0))[0]
    const promoCompraBonusPct = bestPurchasePromo?.bonus_pct ?? 0

    const milhasAComprar = deficit > 0 ? Math.ceil(deficit / (1 + promoCompraBonusPct / 100)) : 0
    const custoCompra = Math.ceil(milhasAComprar / 1000 * baseCostPerK)
    const custoEfetivoPorMil = promoCompraBonusPct > 0
        ? Math.round(baseCostPerK / (1 + promoCompraBonusPct / 100))
        : baseCostPerK

    const promoCompraAtiva = bestPurchasePromo && promoCompraBonusPct > 0
        ? `${String(bestPurchasePromo.titulo ?? '').slice(0, 60)} (+${promoCompraBonusPct}%${bestPurchasePromo.valid_until ? `, expira ${new Date(bestPurchasePromo.valid_until).toLocaleDateString('pt-BR')}` : ''})`
        : null

    const taxasEstimadas = TAXES_BY_PROGRAM[programa] ?? 100
    const custoTotal = custoCompra + taxasEstimadas

    const cashPriceN = cashPrice ?? 0
    const economiaVsCashBrl = cashPriceN > 0 ? Math.round(cashPriceN - custoTotal) : 0
    const economiaVsCashPct = cashPriceN > 0 ? Math.round(economiaVsCashBrl / cashPriceN * 100) : 0
    const cpm = cashPriceN > 0 && milhasNecessarias > 0 ? (cashPriceN * 100) / milhasNecessarias : 0

    return {
        programa,
        milhas_necessarias: milhasNecessarias,
        saldo_direto: saldoDireto,
        transferencias,
        total_potencial: totalPotencial,
        deficit,
        custo_compra_milhas_brl: custoCompra,
        promo_compra_ativa: promoCompraAtiva,
        custo_efetivo_por_mil: custoEfetivoPorMil,
        taxas_estimadas_brl: taxasEstimadas,
        custo_total_brl: custoTotal,
        economia_vs_cash_brl: economiaVsCashBrl,
        economia_vs_cash_pct: economiaVsCashPct,
        cpm,
        melhor_opcao: false,
        disponibilidade_confirmada: programa === confirmedProgram,
    }
}

function buildMultiProgramComparison(
    programs: string[],
    milhasNecessarias: number,
    userData: UserData | null,
    allPromos: PromoRow[],
    cashPrice: number | null | undefined,
    confirmedProgram: string | null
): { analyses: ProgramAnalysis[]; comparisonStr: string } {
    if (milhasNecessarias <= 0 || programs.length === 0) {
        return { analyses: [], comparisonStr: '' }
    }

    const analyses = programs.map(p =>
        analyzeProgram(p, milhasNecessarias, userData, allPromos, cashPrice, confirmedProgram)
    )

    // Sort: full coverage (deficit=0) first, then by total cost ascending
    analyses.sort((a, b) => {
        if (a.deficit === 0 && b.deficit > 0) return -1
        if (b.deficit === 0 && a.deficit > 0) return 1
        return a.custo_total_brl - b.custo_total_brl
    })
    if (analyses.length > 0) analyses[0].melhor_opcao = true

    const lines: string[] = []
    for (const a of analyses) {
        const coverageStr = a.total_potencial >= a.milhas_necessarias
            ? `✓ COBRE TUDO (${a.total_potencial.toLocaleString('pt-BR')} pts disponíveis)`
            : `FALTAM ${a.deficit.toLocaleString('pt-BR')} pts (tem ${a.total_potencial.toLocaleString('pt-BR')} / precisa ${a.milhas_necessarias.toLocaleString('pt-BR')})`

        lines.push(`${a.melhor_opcao ? '★ MELHOR OPÇÃO — ' : ''}${a.programa} | ${coverageStr}`)

        if (a.saldo_direto > 0) {
            lines.push(`  Saldo direto: ${a.saldo_direto.toLocaleString('pt-BR')} pts`)
        }
        for (const t of a.transferencias) {
            const ratioStr = t.promo_bonus_pct > 0
                ? `${t.ratio_base}:1 base + ${t.promo_bonus_pct}% promo = ${t.ratio_efetivo.toFixed(2)}:1 efetivo`
                : `${t.ratio_base}:1 (sem promo)`
            lines.push(`  → ${t.saldo_usuario.toLocaleString('pt-BR')} ${t.source} → rende ${t.milhas_resultantes.toLocaleString('pt-BR')} ${a.programa} (${ratioStr})`)
            if (t.promo_label) lines.push(`    ${t.promo_label}`)
            lines.push(`    Custo efetivo via transferência: ~R$${t.custo_efetivo_por_mil}/mil ${a.programa} (vs R$${BASE_COST_PER_K[a.programa] ?? 50}/mil compra direta)`)
        }

        if (a.deficit > 0) {
            if (a.promo_compra_ativa) {
                lines.push(`  ★ Promo de compra ativa: ${a.promo_compra_ativa} → custo efetivo R$${a.custo_efetivo_por_mil}/mil`)
            } else {
                lines.push(`  Sem promo de compra ativa — preço normal: R$${BASE_COST_PER_K[a.programa] ?? 50}/mil`)
            }
            lines.push(`  Comprar ${a.deficit.toLocaleString('pt-BR')} pts faltantes: ~R$ ${a.custo_compra_milhas_brl.toLocaleString('pt-BR')}`)
        } else {
            lines.push(`  Custo de compra: R$ 0 (cobre tudo com saldo atual)`)
        }

        lines.push(`  Taxas estimadas: ~R$ ${a.taxas_estimadas_brl.toLocaleString('pt-BR')}`)
        const econStr = cashPrice ? ` | Economia: R$ ${a.economia_vs_cash_brl.toLocaleString('pt-BR')} (${a.economia_vs_cash_pct}%)` : ''
        lines.push(`  CUSTO TOTAL: ~R$ ${a.custo_total_brl.toLocaleString('pt-BR')}${econStr}`)
        if (!a.disponibilidade_confirmada) {
            lines.push(`  ⚠ Disponibilidade não confirmada — verifique no site do programa`)
        }
        lines.push('')
    }

    const best = analyses[0]
    const comparisonStr = [
        ...lines,
        `MELHOR OPÇÃO: ${best.programa} — custo total ~R$ ${best.custo_total_brl.toLocaleString('pt-BR')}${cashPrice ? ` (economia de ${best.economia_vs_cash_pct}% vs R$ ${Number(cashPrice).toLocaleString('pt-BR')} em dinheiro)` : ''}`,
        `Gere os steps/step_details detalhando como executar a estratégia com ${best.programa}.`,
    ].join('\n')

    return { analyses, comparisonStr }
}

// ─── User data ────────────────────────────────────────────────────────────────

async function fetchUserData(userId: string, sb: ReturnType<typeof createClient>): Promise<UserData | null> {
    try {
        const { data: { user }, error } = await sb.auth.admin.getUserById(userId)
        if (error || !user) return null
        const meta = user.user_metadata ?? {}
        return {
            miles: (meta.miles ?? {}) as Record<string, number>,
            cards: (meta.activeCards ?? []) as string[],
            clubs: (meta.activeClubs ?? []) as string[],
            clubTiers: (meta.activeClubTiers ?? {}) as Record<string, string>,
        }
    } catch { return null }
}

// ─── JSON schema ──────────────────────────────────────────────────────────────

const JSON_SCHEMA = `{
  "vale_a_pena": <true se CPM >= 1.2 c/pt e a estratégia é executável, false se dinheiro é mais vantajoso>,
  "motivo": "<máx 3 frases. Explique POR QUE o programa recomendado é melhor — cite diferenças de custo entre os programas comparados. Se vale_a_pena false, explique por que dinheiro é melhor.>",
  "steps": [
    "<Passo 1 — título curto (máx 8 palavras)>",
    "<Passo 2 — título curto>",
    "<Passo 3 — título curto>",
    "<Passo 4 — título curto se necessário>"
  ],
  "step_details": [
    "<Passo 1 — explicação didática completa: onde clicar, qual site/app, o que digitar, quanto tempo leva. Inclua URLs e valores exatos da seção COMPARAÇÃO. Mencione bônus de transferência se aplicável.>",
    "<Passo 2 — mesma estrutura>",
    "<Passo 3 — mesma estrutura>",
    "<Passo 4 — mesma estrutura se houver>"
  ],
  "como_completar_faltantes": "<se deficit > 0: melhor forma de obter as milhas que faltam com custo estimado e URL. Se coberto: 'Saldo atual cobre a emissão completa'>",
  "promocao_ativa": "<promoção mais relevante usada na estratégia, ou null>",
  "alternativa": "<segundo programa mais barato da comparação, ou null>",
  "aviso": "<aviso principal ou null>",
  "regras_promocoes": [
    "<Regra importante sobre promoção citada. Ex: 'Bônus Nubank→Smiles limitado a 1 transferência por mês'>",
    "<outra regra se houver>"
  ]
}`

// ─── Serve ────────────────────────────────────────────────────────────────────

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    try {
        // ── Auth ─────────────────────────────────────────────────────────────────
        // Function is deployed with --no-verify-jwt because new Supabase projects
        // use the sb_publishable_... key format, which breaks gateway-level JWT
        // verification. We verify the user's JWT manually here instead.
        const authHeader = req.headers.get('Authorization') ?? ''
        const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

        const sb = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        )

        if (!jwt) {
            return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }
        const { data: { user: jwtUser }, error: jwtError } = await sb.auth.getUser(jwt)
        if (jwtError || !jwtUser) {
            console.error('[strategy] JWT verification failed:', jwtError?.message)
            return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        const { flightId, userId, cashPrice, seatsContext, buscaId } = await req.json()
        if (!flightId && !seatsContext) {
            return new Response(JSON.stringify({ ok: false, error: 'flightId or seatsContext required' }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // 1. Load flight
        let flight: FlightRow | null = null
        if (flightId) {
            const { data, error: fErr } = await sb.from('resultados_voos').select('*').eq('id', flightId).single()
            if (fErr || !data) {
                return new Response(JSON.stringify({ ok: false, error: 'Flight not found' }),
                    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
            }
            flight = data as FlightRow
        } else if (seatsContext) {
            flight = {
                id: 0,
                companhia: `${seatsContext.airlineName} (${seatsContext.airlineCode})`,
                preco_brl: cashPrice || null,
                preco_milhas: seatsContext.totalMilhas,
                taxas_brl: null, cpm: null,
                partida: null, chegada: null,
                origem: seatsContext.origem,
                destino: seatsContext.destino,
                duracao_min: null,
                cabin_class: seatsContext.cabin?.toLowerCase() ?? 'economy',
                segmentos: null, detalhes: null,
            }
        }
        if (!flight) {
            return new Response(JSON.stringify({ ok: false, error: 'No flight data' }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // 2. Plan limits (server-side)
        if (userId) {
            const { data: profile } = await sb
                .from('user_profiles')
                .select('plan, plan_expires_at')
                .eq('id', userId)
                .single()

            const rawPlan = (profile?.plan ?? 'free').toLowerCase()
            const isExpired = profile?.plan_expires_at && new Date(profile.plan_expires_at) < new Date()
            const plan = isExpired ? 'free' : rawPlan

            const LIMITS: Record<string, { lifetime: number | null; perMonth: number | null }> = {
                free:      { lifetime: 1,    perMonth: null },
                essencial: { lifetime: null, perMonth: 3   },
                pro:       { lifetime: null, perMonth: 5   },
                elite:     { lifetime: null, perMonth: 10  },
                admin:     { lifetime: null, perMonth: null },
            }
            const limit = LIMITS[plan] ?? LIMITS['free']

            if (limit.lifetime !== null || limit.perMonth !== null) {
                if (limit.lifetime !== null) {
                    const { count } = await sb
                        .from('strategies')
                        .select('id', { count: 'exact', head: true })
                        .eq('user_id', userId)
                    if ((count ?? 0) >= limit.lifetime) {
                        return new Response(JSON.stringify({ ok: false, error: 'plan_limit_reached', plan }),
                            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
                    }
                } else if (limit.perMonth !== null) {
                    const now2 = new Date()
                    const monthStart = new Date(Date.UTC(now2.getUTCFullYear(), now2.getUTCMonth(), 1))
                    const { count } = await sb
                        .from('strategies')
                        .select('id', { count: 'exact', head: true })
                        .eq('user_id', userId)
                        .gte('created_at', monthStart.toISOString())
                    if ((count ?? 0) >= limit.perMonth) {
                        return new Response(JSON.stringify({ ok: false, error: 'plan_limit_reached', plan }),
                            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
                    }
                }
            }
        }

        // 3. Cache check
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        // Include dataVoo so different travel dates don't share the same cache
        const seatsKey = seatsContext
            ? `seats:${seatsContext.origem}:${seatsContext.destino}:${seatsContext.program.replace(/\s+/g, '_')}:${seatsContext.cabin}:${seatsContext.totalMilhas}${seatsContext.dataVoo ? `:${seatsContext.dataVoo}` : ''}`
            : null

        let cached: { structured_result: unknown; tokens_used: number | null } | null = null

        if (flightId) {
            // Filter by user_id: strategy includes personalized data (balance, clubs)
            let query = sb
                .from('strategies')
                .select('structured_result, tokens_used')
                .eq('flight_id', flightId)
                .gte('created_at', oneDayAgo)
                .not('structured_result', 'is', null)
                .order('created_at', { ascending: false })
                .limit(1)
            if (userId) query = query.eq('user_id', userId)
            const { data } = await query.maybeSingle()
            cached = data
        } else if (seatsKey && userId) {
            // Cache per user+seatsKey (strategy is personalized with user's balance)
            const { data } = await sb
                .from('strategies')
                .select('structured_result, tokens_used')
                .eq('user_id', userId)
                .contains('tags', [seatsKey])
                .gte('created_at', oneDayAgo)
                .not('structured_result', 'is', null)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle()
            cached = data
        }

        const cachedResult = cached?.structured_result as Record<string, unknown> | null
        const isCacheValid = cachedResult &&
            typeof cachedResult.programa_recomendado === 'string' && cachedResult.programa_recomendado.length > 0 &&
            Array.isArray(cachedResult.steps) && (cachedResult.steps as unknown[]).length > 0
        if (isCacheValid) {
            console.log(`[strategy] Cache hit — flight:${flightId ?? 'N/A'} seats:${seatsKey ?? 'N/A'}`)
            return new Response(JSON.stringify({
                ok: true,
                strategy: cachedResult,
                tokens_used: cached!.tokens_used ?? 0,
                cached: true,
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // 4. Build context (cache miss)
        const iata = extractIata(flight.companhia)
        const programs = AIRLINE_PROGRAMS[iata] ?? ['Livelo']
        const targetProgram = seatsContext?.program ?? programs[0] ?? 'Smiles'
        const neededMiles = seatsContext?.totalMilhas ?? (flight.preco_brl ? Math.round((flight.preco_brl * 55) / 1000) * 1000 : 0)

        const [promoResult, userData] = await Promise.all([
            fetchPromos(targetProgram, programs, sb),
            userId ? fetchUserData(userId, sb) : Promise.resolve(null),
        ])

        // Multi-program cost comparison (deterministic server-side math)
        const effectiveCashPrice = cashPrice || flight.preco_brl
        const { analyses, comparisonStr } = buildMultiProgramComparison(
            programs, neededMiles, userData, promoResult.allRows, effectiveCashPrice,
            seatsContext?.program ?? null
        )
        const bestAnalysis = analyses.find(a => a.melhor_opcao) ?? null
        const effectiveTargetProgram = bestAnalysis?.programa ?? targetProgram

        // CPM (based on best program or target)
        const cpmSection = buildCpmSection(effectiveCashPrice, neededMiles)

        // Cards compatible with the best program (for the LLM to mention in steps)
        const compatibleCardsLines: string[] = []
        if (userData?.cards && userData.cards.length > 0) {
            const bases = TRANSFER_BASES[effectiveTargetProgram] ?? []
            const bankPrograms = new Set(bases.map(b => b.source))
            const compatibleCards = userData.cards
                .map(id => CARD_TO_BANK_PROGRAM[id])
                .filter((c): c is { bank: string; label: string } => !!c && bankPrograms.has(c.bank))
            if (compatibleCards.length > 0) {
                const transferUrl = PROGRAM_TRANSFER_URLS[effectiveTargetProgram]
                for (const c of compatibleCards) {
                    const base = bases.find(b => b.source === c.bank)
                    compatibleCardsLines.push(`  ${c.label} → ${c.bank} → ${effectiveTargetProgram} (razão base ${base?.ratio ?? 1}:1)`)
                }
                if (transferUrl) compatibleCardsLines.push(`  URL de transferência: https://${transferUrl}`)
            }
        }

        // 5. Assemble prompt
        const sections: string[] = ['=== VOO SELECIONADO ===', buildFlightString(flight, effectiveTargetProgram)]

        if (seatsContext) {
            const lines = [
                `Disponibilidade REAL encontrada (Seats.aero):`,
                `  Programa: ${seatsContext.program}`,
                `  Ida: ${seatsContext.idaMilhas.toLocaleString('pt-BR')} pts (${seatsContext.origem} → ${seatsContext.destino})`,
            ]
            if (seatsContext.isRoundTrip && seatsContext.voltaMilhas) {
                lines.push(`  Volta: ${seatsContext.voltaMilhas.toLocaleString('pt-BR')} pts (${seatsContext.destino} → ${seatsContext.origem})`)
            }
            lines.push(`  Total: ${seatsContext.totalMilhas.toLocaleString('pt-BR')} pts`)
            if (seatsContext.taxas) lines.push(`  Taxas cobradas: ${seatsContext.taxas}`)
            lines.push(`  Cabine: ${seatsContext.cabin}`)
            sections.push('\n=== DISPONIBILIDADE REAL (Seats.aero) ===', lines.join('\n'))
        }

        if (cpmSection) {
            sections.push('\n=== ANÁLISE DE VALOR ===', cpmSection)
        }

        if (comparisonStr) {
            sections.push('\n=== COMPARAÇÃO PRÉ-CALCULADA DE PROGRAMAS (dados verificados) ===', comparisonStr)
            sections.push('IMPORTANTE: Use os números desta seção nos step_details. NÃO invente custos diferentes.')
        } else if (!userData || Object.keys(userData.miles).length === 0) {
            // No wallet — show cost to acquire miles from scratch
            const transferUrl = PROGRAM_TRANSFER_URLS[effectiveTargetProgram] ?? `${effectiveTargetProgram.toLowerCase().replace(/\s+/g, '')}.com`
            const purchaseSection = buildPurchaseSection(effectiveTargetProgram, neededMiles, promoResult.purchasePromos, effectiveCashPrice)
            sections.push('\n=== COMO OBTER AS MILHAS (usuário sem carteira cadastrada) ===', [
                `Usuário SEM milhas cadastradas. Precisa obter TODAS as ${neededMiles.toLocaleString('pt-BR')} pts de ${effectiveTargetProgram}.`,
                `Opções: (1) COMPRAR no site oficial — ${purchaseSection}`,
                `(2) TRANSFERIR de cartões de crédito bancários para ${effectiveTargetProgram}: https://${transferUrl}`,
            ].join('\n'))
        }

        if (compatibleCardsLines.length > 0) {
            sections.push('\n=== CARTÕES DO USUÁRIO COMPATÍVEIS COM TRANSFERÊNCIA ===', [
                `Cartões do usuário que podem transferir para ${effectiveTargetProgram}:`,
                ...compatibleCardsLines,
                'IMPORTANTE: saldo desses cartões NÃO está na carteira. Sugira verificar e transferir se disponível.',
            ].join('\n'))
        }

        // Clubs
        if (userData?.clubs && userData.clubs.length > 0) {
            const clubLines = userData.clubs.map(c => {
                const tier = userData.clubTiers[c]
                return `  ${c}${tier ? ` (${tier})` : ''}: ${getClubBenefits(c, tier)}`
            })
            sections.push('\n=== CLUBES DO USUÁRIO ===', clubLines.join('\n'))
        }

        sections.push('\n=== PROMOÇÕES ATIVAS (programas relevantes) ===', promoResult.promoStr)
        sections.push(`\nResponda APENAS com JSON neste formato:\n${JSON_SCHEMA}`)

        const userPrompt = sections.join('\n')
        const approxTokens = Math.ceil(userPrompt.length / 4)
        console.log(`[strategy] Flight ${flightId ?? 'seats'} | ~${approxTokens} input tokens | best: ${effectiveTargetProgram} (${analyses.length} programs analyzed)`)

        // 6. Call OpenAI
        const openaiKey = Deno.env.get('OPENAI_API_KEY')
        if (!openaiKey) throw new Error('OPENAI_API_KEY not set in Edge Function secrets')

        const llmRes = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: `Você é FlyWise, especialista em milhas e programas de fidelidade do Brasil.
Gere uma estratégia HONESTA, PERSONALIZADA e EXECUTÁVEL com base nos dados fornecidos.

REGRAS OBRIGATÓRIAS:
1. ANALISE o CPM fornecido. Se CPM < 1.2 c/pt → defina vale_a_pena: false e explique claramente por que dinheiro é melhor.
2. A seção "COMPARAÇÃO PRÉ-CALCULADA" contém dados verificados — use esses números exatos no motivo e step_details. NÃO invente custos diferentes.
3. Gere steps/step_details para o programa marcado como "★ MELHOR OPÇÃO" na comparação.
4. No motivo, explique POR QUE este programa é melhor que os outros — cite as diferenças de custo total entre os programas comparados.
5. NUNCA sugira solicitar ou contratar novo cartão de crédito — PROIBIDO.
6. Se a comparação mostra "✓ COBRE TUDO", o passo 1 DEVE usar o saldo existente diretamente.
7. Se há transferência com "★ PROMO ATIVA" na comparação, PRIORIZE esse caminho e explique o bônus no step_details com o ratio exato (ex: "1:1 base + 80% promo = 1.8:1 efetivo").
8. Se o usuário tem clube (ex: Smiles Diamante), mencione o benefício EXPLICITAMENTE no passo relevante.
9. Se deficit > 0 ou usuário não tem carteira: OBRIGATÓRIO um passo "Comprar milhas" com custo exato da comparação e URL do programa.
10. steps: TÍTULO curto (máx 8 palavras). step_details: explicação didática completa — onde clicar, qual site/app, o que esperar, quanto tempo leva. Inclua URLs exatas.
11. Se vale_a_pena: false: steps devem guiar o usuário para o que fazer (reservar em dinheiro, aguardar promo, acumular mais).
12. Responda APENAS em JSON válido, sem texto adicional.`,
                    },
                    { role: 'user', content: userPrompt },
                ],
                response_format: { type: 'json_object' },
                max_tokens: 2000,
                temperature: 0.2,
            }),
        })

        const llmData = await llmRes.json()
        if (!llmRes.ok) {
            const detail = llmData.error?.message ?? llmData.error?.code ?? JSON.stringify(llmData.error ?? {})
            console.error(`[strategy] OpenAI error ${llmRes.status}:`, detail)
            throw new Error(`OpenAI ${llmRes.status}: ${detail}`)
        }

        const strategyJson = llmData.choices?.[0]?.message?.content ?? '{}'
        const tokensUsed = llmData.usage?.total_tokens ?? 0
        let parsed: Record<string, unknown> = {}
        try { parsed = JSON.parse(strategyJson) } catch { /* raw fallback */ }

        // Validate required LLM fields (programa_recomendado is now server-side)
        const hasRequiredFields =
            Array.isArray(parsed.steps) && (parsed.steps as unknown[]).length > 0 &&
            Array.isArray(parsed.step_details) && (parsed.step_details as unknown[]).length > 0
        if (!hasRequiredFields) {
            console.error('[strategy] GPT response missing required fields:', strategyJson.slice(0, 200))
            throw new Error('A IA retornou uma resposta incompleta. Tente novamente em instantes.')
        }

        // Merge server-side computed data with LLM narrative output
        const cpmResgate = bestAnalysis?.cpm ?? 0
        const cpmAvaliacao = cpmResgate >= 3.5 ? 'EXCELENTE' : cpmResgate >= 2.5 ? 'MUITO BOM' : cpmResgate >= 1.8 ? 'BOM' : cpmResgate >= 1.2 ? 'RAZOÁVEL' : 'RUIM'
        const mergedResult: Record<string, unknown> = {
            ...parsed,
            programa_recomendado: effectiveTargetProgram,
            cpm_resgate: parseFloat(cpmResgate.toFixed(2)),
            cpm_avaliacao: cpmAvaliacao,
            milhas_necessarias: bestAnalysis?.milhas_necessarias ?? neededMiles,
            milhas_em_carteira: bestAnalysis?.saldo_direto ?? 0,
            milhas_faltantes: bestAnalysis?.deficit ?? 0,
            taxas_estimadas_brl: bestAnalysis?.taxas_estimadas_brl ?? 80,
            economia_pct: Math.max(0, bestAnalysis?.economia_vs_cash_pct ?? 0),
            economia_brl: Math.max(0, bestAnalysis?.economia_vs_cash_brl ?? 0),
            comparacao_programas: analyses.length > 0 ? analyses : undefined,
        }

        // 7. Save to strategies table (non-blocking)
        if (userId) {
            try {
                // Prefer buscaId from frontend; fallback to most recent busca
                let resolvedBuscaId: number | null = buscaId ?? null
                if (!resolvedBuscaId) {
                    const { data: busca } = await sb.from('buscas').select('id')
                        .eq('user_id', userId)
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .maybeSingle()
                    resolvedBuscaId = busca?.id ?? null
                }

                const tags = [effectiveTargetProgram, iata, seatsKey, 'llm'].filter(Boolean) as string[]

                await sb.from('strategies').insert({
                    user_id: userId,
                    busca_id: resolvedBuscaId,
                    flight_id: flightId ?? null,
                    strategy_text: (parsed.steps as string[] ?? []).join('\n\n'),
                    tags,
                    economia_pct: mergedResult.economia_pct ?? null,
                    preco_cash: flight.preco_brl,
                    preco_estrategia: mergedResult.taxas_estimadas_brl ?? null,
                    structured_result: mergedResult,
                    llm_model: 'gpt-4o-mini',
                    tokens_used: tokensUsed,
                })
            } catch (saveErr) {
                console.error('[strategy] DB save failed (non-blocking):', saveErr)
            }
        }

        return new Response(JSON.stringify({
            ok: true,
            strategy: mergedResult,
            tokens_used: tokensUsed,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    } catch (err) {
        console.error('[strategy] Error:', err)
        return new Response(JSON.stringify({ ok: false, error: String(err) }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
})
