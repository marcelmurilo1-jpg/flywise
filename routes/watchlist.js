import { Router } from 'express';
import pLimit from 'p-limit';
import { supabase } from '../lib/supabase.js';
import { resend, RESEND_FROM } from '../lib/resend.js';
import { fetchSeatsAeroAPI, mapSeatsAeroItem } from '../lib/seatsAero.js';
import { getAmadeusToken, AMADEUS_BASE } from '../lib/amadeus.js';
import { requireUserJWT, requireSyncSecret, getWatchlistLimit } from '../middleware/auth.js';

const router = Router();

// ─── Watchlist CRUD ───────────────────────────────────────────────────────────

// GET /api/watchlist — list user's active watchlist items
router.get('/api/watchlist', requireUserJWT, async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase indisponível' });
    const limit = await getWatchlistLimit(req.userId);
    const { data, error } = await supabase
        .from('watchlist_items')
        .select('*')
        .eq('user_id', req.userId)
        .eq('active', true)
        .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ items: data ?? [], limit, used: (data ?? []).length });
});

// POST /api/watchlist — create a new watchlist item
router.post('/api/watchlist', requireUserJWT, async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase indisponível' });

    const limit = await getWatchlistLimit(req.userId);
    if (limit === 0) return res.status(403).json({ error: 'Seu plano não inclui watchlist. Faça upgrade.' });

    const { count } = await supabase
        .from('watchlist_items')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', req.userId)
        .eq('active', true);
    if ((count ?? 0) >= limit) {
        return res.status(403).json({ error: `Limite de ${limit} rotas atingido. Exclua uma ou faça upgrade.` });
    }

    const { type, origin, destination, threshold_brl, airline, travel_date,
            threshold_miles, program, cabin, channel } = req.body ?? {};

    if (!type || !['cash', 'miles'].includes(type) || !origin || !destination) {
        return res.status(400).json({ error: 'type deve ser "cash" ou "miles", origin e destination são obrigatórios' });
    }
    if (type === 'cash' && (!threshold_brl || isNaN(Number(threshold_brl)) || Number(threshold_brl) <= 0)) {
        return res.status(400).json({ error: 'threshold_brl deve ser um número positivo' });
    }
    if (type === 'miles' && (!threshold_miles || isNaN(Number(threshold_miles)) || Number(threshold_miles) <= 0)) {
        return res.status(400).json({ error: 'threshold_miles deve ser um número positivo' });
    }

    const { data, error } = await supabase.from('watchlist_items').insert([{
        user_id: req.userId,
        type,
        origin: origin.toUpperCase(),
        destination: destination.toUpperCase(),
        threshold_brl: threshold_brl ?? null,
        airline: airline ?? null,
        travel_date: travel_date ?? null,
        threshold_miles: threshold_miles ?? null,
        program: program ?? null,
        cabin: cabin ?? null,
        channel: channel ?? 'email',
    }]).select().single();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json({ item: data });
});

// PATCH /api/watchlist/:id — update channel or threshold
router.patch('/api/watchlist/:id', requireUserJWT, async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase indisponível' });
    const { channel, threshold_brl, threshold_miles } = req.body ?? {};
    const updates = {};
    if (channel) updates.channel = channel;
    if (threshold_brl != null) updates.threshold_brl = threshold_brl;
    if (threshold_miles != null) updates.threshold_miles = threshold_miles;
    const { data, error } = await supabase
        .from('watchlist_items')
        .update(updates)
        .eq('id', req.params.id)
        .eq('user_id', req.userId)
        .select()
        .single();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'Item não encontrado' });
    res.json({ item: data });
});

// DELETE /api/watchlist/:id — soft delete (active = false)
router.delete('/api/watchlist/:id', requireUserJWT, async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase indisponível' });
    const { data, error } = await supabase
        .from('watchlist_items')
        .update({ active: false })
        .eq('id', req.params.id)
        .eq('user_id', req.userId)
        .select();
    if (error) return res.status(500).json({ error: error.message });
    if (!data || data.length === 0) return res.status(404).json({ error: 'Item não encontrado' });
    res.json({ ok: true });
});

// ─── Watchlist email sender ───────────────────────────────────────────────────
async function fetchPromosParaPrograma(program) {
    if (!program || !supabase) return []
    try {
        const now = new Date().toISOString()
        const { data } = await supabase
            .from('promocoes')
            .select('titulo, subcategoria, bonus_pct, valid_until')
            .or(`valid_until.is.null,valid_until.gt.${now}`)
            .eq('categoria', 'milhas')
            .overlaps('programas_tags', [program])
            .order('valid_until', { ascending: true, nullsFirst: false })
            .limit(3)
        return data ?? []
    } catch { return [] }
}

async function sendWatchlistEmail({ toEmail, toName, item, triggeredValue, promosAtivas = [], notifyCount = 1, maxNotify = 3, reachedLimit = false }) {
    if (!resend) { console.warn('[Watchlist] Resend não configurado.'); return; }

    const isCash = item.type === 'cash';
    const subject = isCash
        ? `✈️ Alerta FlyWise — Preço caiu! ${item.origin}→${item.destination} R$ ${triggeredValue.toLocaleString('pt-BR')}`
        : `✈️ Alerta FlyWise — Preço em milhas Caiu! ${item.origin}→${item.destination} ${item.program} ${triggeredValue.toLocaleString('pt-BR')} milhas`;

    const appUrl = process.env.FRONTEND_URL ?? process.env.APP_URL ?? 'https://flywisebr.com';
    const ctaUrl = isCash
        ? `${appUrl}/resultados?orig=${item.origin}&dest=${item.destination}&date=${item.travel_date ?? ''}`
        : `${appUrl}/resultados?orig=${item.origin}&dest=${item.destination}`;

    const priceLabel = isCash
        ? `R$ ${triggeredValue.toLocaleString('pt-BR')}`
        : `${triggeredValue.toLocaleString('pt-BR')} milhas`;
    const limitLabel = isCash
        ? `R$ ${item.threshold_brl.toLocaleString('pt-BR')}`
        : `${item.threshold_miles.toLocaleString('pt-BR')} milhas`;
    const diff = isCash
        ? item.threshold_brl - triggeredValue
        : item.threshold_miles - triggeredValue;
    const diffLabel = isCash
        ? `R$ ${diff.toLocaleString('pt-BR')} abaixo do seu limite`
        : `${diff.toLocaleString('pt-BR')} milhas abaixo do seu limite`;
    const ctaText = isCash ? 'Ver voo agora →' : 'Ver estratégia →';
    const headerEmoji = isCash ? '✈️' : '🎯';
    const headerTitle = isCash ? 'Preço caiu!' : 'Preço em milhas Caiu!';
    const subInfo = isCash
        ? `${item.origin} → ${item.destination}${item.airline ? ` · ${item.airline}` : ''}${item.travel_date ? ` · ${item.travel_date}` : ''}`
        : `${item.origin} → ${item.destination} · ${item.program ?? ''} · ${item.cabin === 'business' ? 'Business' : 'Economy'}`;

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<style>
  body{font-family:'Segoe UI',system-ui,sans-serif;background:#F7F9FC;margin:0;padding:24px 16px}
  .wrap{max-width:520px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 8px 48px rgba(14,42,85,.12)}
  .hdr{background:linear-gradient(135deg,#0E2A55,#2A60C2);padding:28px 32px 24px;text-align:center}
  .logo{font-size:22px;font-weight:900;color:#fff;letter-spacing:-.03em}
  .logo span{color:rgba(255,255,255,.5)}
  .tag{font-size:11px;color:rgba(255,255,255,.6);font-weight:600;letter-spacing:.06em;text-transform:uppercase;margin-top:4px}
  .banner{padding:20px 32px 16px;border-bottom:1px solid #E2EAF5}
  .em{font-size:32px;display:block;margin-bottom:8px}
  .ttl{font-size:20px;font-weight:900;color:#0E2A55;letter-spacing:-.02em;margin-bottom:4px}
  .sub{font-size:13px;color:#6B7A99;font-weight:600}
  .card{margin:20px 32px;background:#F7F9FC;border:1.5px solid #E2EAF5;border-radius:14px;padding:18px 20px}
  .rname{font-size:16px;font-weight:900;color:#0E2A55;letter-spacing:-.01em;margin-bottom:4px}
  .rsub{font-size:12px;color:#6B7A99;font-weight:600;margin-bottom:16px}
  .prow{display:flex;align-items:center;justify-content:space-between;gap:12px}
  .pnow{flex:1;background:linear-gradient(135deg,#0E2A55,#2A60C2);border-radius:12px;padding:14px 16px;text-align:center;color:#fff}
  .plbl{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:rgba(255,255,255,.65);margin-bottom:4px}
  .pval{font-size:22px;font-weight:900;letter-spacing:-.02em}
  .arr{font-size:20px;color:#C0CFEA;flex-shrink:0}
  .pwas{flex:1;background:#fff;border:1.5px solid #E2EAF5;border-radius:12px;padding:14px 16px;text-align:center}
  .pwas .plbl{color:#A0AECB}
  .pwas .pval{font-size:18px;font-weight:800;color:#C0CFEA;text-decoration:line-through}
  .sav{margin:0 32px 20px;background:#ECFDF5;border:1.5px solid #6EE7B7;border-radius:10px;padding:10px 16px;font-size:13px;font-weight:700;color:#065F46}
  .cta{margin:0 32px 20px;text-align:center}
  .btn{display:inline-block;background:linear-gradient(135deg,#2A60C2,#1A4A9C);color:#fff;font-size:14px;font-weight:800;padding:14px 32px;border-radius:12px;text-decoration:none;letter-spacing:-.01em}
  .ftr{border-top:1px solid #E2EAF5;padding:16px 32px 20px;text-align:center;font-size:11px;color:#A0AECB;line-height:1.6}
  .ftr a{color:#2A60C2;text-decoration:none;font-weight:700}
</style>
</head>
<body>
<div class="wrap">
  <div class="hdr">
    <div class="logo">Fly<span>Wise</span></div>
    <div class="tag">${isCash ? 'Alerta de Preço' : 'Alerta de Milhas'}</div>
  </div>
  <div class="banner">
    <span class="em">${headerEmoji}</span>
    <div class="ttl">${headerTitle}</div>
    <div class="sub">Oi ${toName ?? 'viajante'}, o preço que você monitorava caiu!</div>
  </div>
  <div class="card">
    <div class="rname">${item.origin} → ${item.destination}</div>
    <div class="rsub">${subInfo}</div>
    <div class="prow">
      <div class="pnow"><div class="plbl">Agora</div><div class="pval">${priceLabel}</div></div>
      <div class="arr">↓</div>
      <div class="pwas"><div class="plbl">Seu limite</div><div class="pval">${limitLabel}</div></div>
    </div>
  </div>
  <div class="sav">💚 ${diffLabel} — aproveite antes de subir!</div>
  ${promosAtivas.length > 0 ? `
  <div style="margin:0 32px 20px;padding:16px;background:#EDE9FE;border-radius:12px;">
    <div style="font-size:11px;font-weight:700;color:#6D28D9;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;">⚡ Promoções ativas para ${item.program ?? ''}</div>
    ${promosAtivas.map(p => `
      <div style="font-size:13px;color:#374151;margin-bottom:4px;">
        ${p.subcategoria === 'transferencia' ? '🔄' : p.subcategoria === 'clube' ? '⭐' : '📍'}
        ${p.titulo}
        ${p.valid_until ? `<span style="font-size:11px;color:#6D28D9;"> · expira ${new Date(p.valid_until).toLocaleDateString('pt-BR')}</span>` : ''}
      </div>
    `).join('')}
  </div>` : ''}
  <div class="cta"><a href="${ctaUrl}" class="btn">${ctaText}</a></div>
  <div class="ftr">
    ${reachedLimit
        ? `Este alerta foi <strong>desativado automaticamente</strong> após ${maxNotify} notificações enviadas.<br>Reative em configurações se quiser continuar monitorando.`
        : `Aviso ${notifyCount} de ${maxNotify} · você receberá novo aviso apenas se o preço cair ainda mais.`
    }<br>
    <a href="${appUrl}/configuracoes">Gerenciar alertas</a> · <a href="${appUrl}/configuracoes">Cancelar este alerta</a>
  </div>
</div>
</body>
</html>`;

    try {
        await resend.emails.send({
            from: RESEND_FROM,
            to: toEmail,
            subject,
            html,
        });
        console.log(`[Watchlist] Email enviado para ${toEmail}: ${item.origin}→${item.destination}`);
    } catch (e) {
        console.error('[Watchlist] Erro ao enviar email:', e.message);
    }
}

// POST /api/watchlist/check — triggered daily by GitHub Actions
router.post('/api/watchlist/check', requireSyncSecret, async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase indisponível' });

    const MAX_NOTIFY    = 3;   // auto-deactivate after 3 triggers
    const MAX_AGE_DAYS  = 60; // auto-deactivate after 60 days
    const now = new Date();
    const expiryDate = new Date(now.getTime() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000).toISOString();

    // Load all active items created within the last MAX_AGE_DAYS days
    const { data: items, error: loadErr } = await supabase
        .from('watchlist_items')
        .select('*')
        .eq('active', true)
        .gt('created_at', expiryDate);

    // Auto-deactivate items older than MAX_AGE_DAYS (in background)
    supabase.from('watchlist_items')
        .update({ active: false })
        .eq('active', true)
        .lte('created_at', expiryDate)
        .then();

    if (loadErr) return res.status(500).json({ error: loadErr.message });
    if (!items || items.length === 0) return res.json({ checked: 0, triggered: 0 });

    // Load user emails in bulk via admin auth API
    const userIds = [...new Set(items.map(i => i.user_id))];
    let emailMap = {};
    let nameMap = {};
    try {
        const { data: { users } } = await supabase.auth.admin.listUsers({ perPage: 1000 });
        for (const u of (users ?? [])) {
            if (userIds.includes(u.id)) {
                emailMap[u.id] = u.email;
                nameMap[u.id] = u.user_metadata?.name ?? u.email?.split('@')[0] ?? 'viajante';
            }
        }
    } catch (e) {
        console.warn('[Watchlist] Não foi possível carregar emails de usuários:', e.message);
    }

    const checkLimit = pLimit(2); // max 2 scrapes in parallel
    let triggered = 0;

    const tasks = items.map(item => checkLimit(async () => {
        try {
            let triggeredValue = null;

            if (item.type === 'cash') {
                const date = item.travel_date ?? (() => {
                    const d = new Date();
                    d.setMonth(d.getMonth() + 1);
                    d.setDate(15);
                    return d.toISOString().slice(0, 10);
                })();
                const token = await getAmadeusToken();
                const qp = new URLSearchParams({
                    originLocationCode: item.origin,
                    destinationLocationCode: item.destination,
                    departureDate: date,
                    adults: '1',
                    currencyCode: 'BRL',
                    max: '10',
                });
                const amRes = await fetch(`${AMADEUS_BASE}/v2/shopping/flight-offers?${qp}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (!amRes.ok) return;
                const amData = await amRes.json();
                const offers = amData.data ?? [];
                const candidates = offers
                    .filter(o => !item.airline || o.itineraries?.[0]?.segments?.[0]?.carrierCode === item.airline)
                    .map(o => parseFloat(o.price?.grandTotal ?? o.price?.total ?? '0'))
                    .filter(p => p > 0);
                if (candidates.length === 0) return;
                const best = Math.min(...candidates);

                // Always update the last known price
                await supabase.from('watchlist_items')
                    .update({ last_checked_at: now.toISOString(), last_price_brl: best })
                    .eq('id', item.id);

                // Notify only if below threshold AND actually dropped since last check
                const lastPrice = item.last_price_brl ?? Infinity;
                if (best < item.threshold_brl && best < lastPrice) triggeredValue = best;

            } else {
                // miles
                const date = item.travel_date ?? (() => {
                    const d = new Date();
                    d.setMonth(d.getMonth() + 1);
                    d.setDate(15);
                    return d.toISOString().slice(0, 10);
                })();
                const raw = await fetchSeatsAeroAPI(item.origin, item.destination, date);
                const mapped = raw.map(r => mapSeatsAeroItem(r, 'ida'));
                const cabin = item.cabin === 'business' ? 'business' : 'economy';
                const candidates = mapped.filter(r => {
                    const src = (r.source ?? r.programName ?? '').toLowerCase();
                    const prog = (item.program ?? '').toLowerCase();
                    return (!item.program || src.includes(prog) || prog.includes(src)) && r[cabin] != null;
                });
                if (candidates.length === 0) return;
                const best = Math.min(...candidates.map(r => r[cabin]));

                // Always update the last known price
                await supabase.from('watchlist_items')
                    .update({ last_checked_at: now.toISOString(), last_price_miles: best })
                    .eq('id', item.id);

                // Notify only if below threshold AND actually dropped since last check
                const lastPrice = item.last_price_miles ?? Infinity;
                if (best < item.threshold_miles && best < lastPrice) triggeredValue = best;
            }

            if (triggeredValue === null) return;

            // Send email
            const toEmail = emailMap[item.user_id];
            if (toEmail) {
                const newCount = (item.notify_count ?? 0) + 1;
                const reachedLimit = newCount >= MAX_NOTIFY;
                const promosAtivas = item.program ? await fetchPromosParaPrograma(item.program) : []
                await sendWatchlistEmail({
                    toEmail,
                    toName: nameMap[item.user_id],
                    item,
                    triggeredValue,
                    promosAtivas,
                    notifyCount: newCount,
                    maxNotify: MAX_NOTIFY,
                    reachedLimit,
                });
                await supabase.from('watchlist_items')
                    .update({
                        last_notified_at: now.toISOString(),
                        notify_count: newCount,
                        ...(reachedLimit ? { active: false } : {}),
                    })
                    .eq('id', item.id);
                triggered++;
            }
        } catch (e) {
            console.error(`[Watchlist] Erro ao checar item ${item.id}:`, e.message);
        }
    }));

    await Promise.all(tasks);
    console.log(`[Watchlist] Verificados: ${items.length} | Alertas enviados: ${triggered}`);
    res.json({ checked: items.length, triggered });
});

export default router;
