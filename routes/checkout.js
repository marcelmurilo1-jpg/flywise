import { Router } from 'express';
import { supabase } from '../lib/supabase.js';
import { resend, RESEND_FROM } from '../lib/resend.js';
import { requireUserJWT } from '../middleware/auth.js';

const router = Router();

const ABACATEPAY_API_KEY = process.env.ABACATEPAY_API_KEY || 'abc_dev_GwmHy0SnK5CAeB3YWPKckZrx';
const ABACATEPAY_BASE = 'https://api.abacatepay.com/v1';

const ABACATEPAY_PRODUCT_IDS = {
    essencial_mensal: 'prod_YDKXdraxPUfeRsnsZDgMMDCg',
    essencial_anual:  'prod_Qh0AG6G1K14s2amwwDGjrgZ6',
    pro_mensal:       'prod_hMpBPa4bJAs5tPe61kx6P5PP',
    pro_anual:        'prod_Q2L5JHSQspgQ2ESqQrer6qfk',
    elite_mensal:     'prod_xF0RRKduTfm5mbjBfuL3yDx6',
    elite_anual:      'prod_LaAabZfjm0KxAT3exn11EQTr',
};

router.post('/api/checkout', async (req, res) => {
    const { origin, destination, departureDate, returnDate, totalBrl, outboundCompany, returnCompany, customerName, customerEmail, customerTaxId, customerPhone, userId, billingType, returnPath } = req.body;

    if (!totalBrl || totalBrl <= 0) {
        return res.status(400).json({ error: 'totalBrl é obrigatório e deve ser maior que zero' });
    }

    const abHeaders = {
        'Authorization': `Bearer ${ABACATEPAY_API_KEY}`,
        'Content-Type': 'application/json',
    };

    try {
        // 1. Criar ou recuperar cliente
        const customerPayload = {
            name: customerName || 'FlyWise User',
            email: customerEmail || 'user@flywise.app',
            taxId: customerTaxId || '52998224725',
            cellphone: customerPhone || '11999999999',
        };

        const custRes = await fetch(`${ABACATEPAY_BASE}/customer/create`, {
            method: 'POST',
            headers: abHeaders,
            body: JSON.stringify(customerPayload),
            signal: AbortSignal.timeout(15000),
        });
        const custData = await custRes.json();
        console.log('[AbacatePay] Customer:', JSON.stringify(custData).slice(0, 200));

        const customerId = custData.data?.id;
        if (!customerId) {
            console.error('[AbacatePay] Falha ao criar cliente:', custData);
            return res.status(400).json({ error: custData.error || 'Falha ao criar cliente no AbacatePay' });
        }

        // 2. Criar cobrança
        const productName = returnDate
            ? `Passagem Aérea ${origin}→${destination} + ${destination}→${origin}`
            : origin === 'PLANO'
                ? `FlyWise ${destination} — Assinatura`
                : `Passagem Aérea ${origin}→${destination}`;

        const externalId = `flywise-${origin}-${destination}-${Date.now()}`;

        const productKey = origin === 'PLANO'
            ? `${destination.toLowerCase()}_${billingType ?? 'mensal'}`
            : null;
        const registeredProductId = productKey ? ABACATEPAY_PRODUCT_IDS[productKey] : null;

        const productEntry = registeredProductId
            ? { externalId: registeredProductId, name: productName, quantity: 1, price: Math.round(totalBrl * 100) }
            : { externalId, name: productName, quantity: 1, price: Math.round(totalBrl * 100) };

        const methodMap = {
            cartao: ['CARD'],
            ambos:  ['PIX', 'CARD'],
        };
        const methods = methodMap[req.body.paymentMethod] ?? ['PIX'];

        const billingPayload = {
            frequency: billingType === 'anual' ? 'YEARLY' : 'MONTHLY',
            methods,
            customerId,
            products: [productEntry],
            returnUrl: `${process.env.FRONTEND_URL || req.headers.origin || 'http://localhost:5173'}${returnPath || '/onboarding'}`,
            completionUrl: `${process.env.FRONTEND_URL || req.headers.origin || 'http://localhost:5173'}${returnPath || '/onboarding'}`,
            metadata: { origin, destination, departureDate, returnDate, outboundCompany, returnCompany, userId, billingType },
            ...(req.body.cardToken ? { card: { token: req.body.cardToken } } : {}),
            ...(req.body.installments > 1 ? { installments: Number(req.body.installments) } : {}),
        };

        const abRes = await fetch(`${ABACATEPAY_BASE}/billing/create`, {
            method: 'POST',
            headers: abHeaders,
            body: JSON.stringify(billingPayload),
            signal: AbortSignal.timeout(15000),
        });
        const abData = await abRes.json();

        if (!abRes.ok || abData.error) {
            console.error('[AbacatePay] Erro billing:', abData);
            return res.status(abRes.status).json({ error: abData.error || 'Erro ao criar cobrança' });
        }

        console.log('[AbacatePay] Billing criado:', JSON.stringify(abData).slice(0, 400));

        const d = abData.data ?? {};
        const responseMethods = d.methods ?? [];
        const pixMethod = responseMethods.find(m => m.method === 'PIX') ?? responseMethods[0] ?? {};
        const pixCode = pixMethod.pixCode ?? pixMethod.brCode ?? d.brCode ?? d.pixCode ?? d.pixCopyPaste ?? null;
        const pixQrCode = pixMethod.pixQrCode ?? pixMethod.qrCodeImage ?? d.qrCodeImage ?? null;

        res.json({
            id: d.id,
            url: d.url,
            pixCode,
            pixQrCode,
            status: d.status ?? 'PENDING',
        });
    } catch (err) {
        console.error('[AbacatePay] Exceção:', err.message);
        res.status(500).json({ error: err.message });
    }
});

router.get('/api/checkout/status/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const abRes = await fetch(`${ABACATEPAY_BASE}/billing/list`, {
            headers: { 'Authorization': `Bearer ${ABACATEPAY_API_KEY}` },
            signal: AbortSignal.timeout(10000),
        });
        const abData = await abRes.json();
        const billings = Array.isArray(abData.data) ? abData.data : [];
        const billing = billings.find(b => b.id === id) ?? {};
        res.json({ status: billing.status ?? 'PENDING', id: billing.id ?? id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PLAN_LABELS = { essencial: 'Essencial', pro: 'Pro', elite: 'Elite' };
const PLAN_FEATURES = {
    essencial: ['Busca de voos com milhas', 'Calculadora de transferências', '3 rotas no Watchlist'],
    pro:       ['Tudo do Essencial', '10 rotas no Watchlist', 'Estratégia personalizada IA', 'Alertas prioritários'],
    elite:     ['Tudo do Pro', 'Watchlist ilimitado', 'Chat IA exclusivo', 'Suporte VIP'],
};

async function sendWelcomeEmail({ userId, plan, billingType, expiresAt, billingId, amountCents }) {
    if (!resend || !supabase) return;
    try {
        const { data: { user } } = await supabase.auth.admin.getUserById(userId);
        if (!user?.email) return;

        const toEmail = user.email;
        const toName = user.user_metadata?.name ?? toEmail.split('@')[0] ?? 'viajante';
        const planLabel = PLAN_LABELS[plan] ?? plan;
        const billing = billingType === 'anual' ? 'Anual' : 'Mensal';
        const appUrl = process.env.FRONTEND_URL ?? 'https://flywisebr.com';
        const expiresLabel = new Date(expiresAt).toLocaleDateString('pt-BR');
        const amountLabel = amountCents ? `R$ ${(amountCents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : null;
        const features = PLAN_FEATURES[plan] ?? [];
        const txId = billingId ?? '—';
        const paidAt = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

        const featureRows = features.map(f => `
          <tr>
            <td style="padding:6px 0;font-size:14px;color:#374151;">
              <span style="color:#2A60C2;font-weight:700;margin-right:8px;">✓</span>${f}
            </td>
          </tr>`).join('');

        const receiptSection = `
          <div style="margin:20px 32px;background:#F7F9FC;border:1.5px solid #E2EAF5;border-radius:14px;padding:18px 20px;">
            <div style="font-size:11px;font-weight:700;color:#6B7A99;text-transform:uppercase;letter-spacing:.06em;margin-bottom:12px;">Recibo de Pagamento</div>
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="font-size:13px;color:#6B7A99;padding:4px 0;">Plano</td>
                <td style="font-size:13px;color:#0E2A55;font-weight:700;text-align:right;padding:4px 0;">FlyWise ${planLabel} ${billing}</td>
              </tr>
              ${amountLabel ? `<tr>
                <td style="font-size:13px;color:#6B7A99;padding:4px 0;">Valor pago</td>
                <td style="font-size:13px;color:#0E2A55;font-weight:700;text-align:right;padding:4px 0;">${amountLabel}</td>
              </tr>` : ''}
              <tr>
                <td style="font-size:13px;color:#6B7A99;padding:4px 0;">Data do pagamento</td>
                <td style="font-size:13px;color:#0E2A55;font-weight:700;text-align:right;padding:4px 0;">${paidAt}</td>
              </tr>
              <tr>
                <td style="font-size:13px;color:#6B7A99;padding:4px 0;">Válido até</td>
                <td style="font-size:13px;color:#0E2A55;font-weight:700;text-align:right;padding:4px 0;">${expiresLabel}</td>
              </tr>
              <tr>
                <td style="font-size:13px;color:#6B7A99;padding:4px 0;">ID da transação</td>
                <td style="font-size:11px;color:#6B7A99;text-align:right;padding:4px 0;word-break:break-all;">${txId}</td>
              </tr>
            </table>
          </div>`;

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
  .banner{padding:24px 32px 20px;border-bottom:1px solid #E2EAF5}
  .ttl{font-size:22px;font-weight:900;color:#0E2A55;letter-spacing:-.02em;margin-bottom:6px}
  .sub{font-size:14px;color:#6B7A99;line-height:1.5}
  .badge{display:inline-block;background:linear-gradient(135deg,#0E2A55,#2A60C2);color:#fff;font-size:13px;font-weight:800;padding:6px 16px;border-radius:20px;margin-bottom:12px}
  .cta{margin:20px 32px;text-align:center}
  .btn{display:inline-block;background:linear-gradient(135deg,#2A60C2,#1A4A9C);color:#fff;font-size:14px;font-weight:800;padding:14px 36px;border-radius:12px;text-decoration:none;letter-spacing:-.01em}
  .ftr{border-top:1px solid #E2EAF5;padding:16px 32px 20px;text-align:center;font-size:11px;color:#A0AECB;line-height:1.6}
  .ftr a{color:#2A60C2;text-decoration:none;font-weight:700}
</style>
</head>
<body>
<div class="wrap">
  <div class="hdr">
    <div class="logo">Fly<span>Wise</span></div>
    <div class="tag">Confirmação de Assinatura</div>
  </div>
  <div class="banner">
    <div style="font-size:40px;margin-bottom:12px;">🎉</div>
    <div class="badge">FlyWise ${planLabel} ${billing}</div>
    <div class="ttl">Bem-vindo ao FlyWise, ${toName}!</div>
    <div class="sub">Sua assinatura foi confirmada com sucesso. Agora você tem acesso completo ao plano <strong>${planLabel}</strong>.</div>
  </div>
  <div style="margin:20px 32px 4px;">
    <div style="font-size:11px;font-weight:700;color:#6B7A99;text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px;">O que está incluído</div>
    <table width="100%" cellpadding="0" cellspacing="0" border="0">${featureRows}</table>
  </div>
  ${receiptSection}
  <div class="cta"><a href="${appUrl}" class="btn">Acessar FlyWise →</a></div>
  <div class="ftr">
    Dúvidas? Fale com a gente em <a href="mailto:suporte@flywise.app">suporte@flywise.app</a><br>
    FlyWise · Feito para quem viaja com inteligência
  </div>
</div>
</body>
</html>`;

        await resend.emails.send({
            from: RESEND_FROM,
            to: toEmail,
            subject: `🎉 Bem-vindo ao FlyWise ${planLabel}! Sua assinatura está ativa`,
            html,
        });
        console.log(`[Checkout] Email de boas-vindas enviado para ${toEmail} — plano ${plan}`);
    } catch (e) {
        console.error('[Checkout] Erro ao enviar email de boas-vindas:', e.message);
    }
}

router.post('/api/webhook/abacatepay', async (req, res) => {
    const webhookSecret = process.env.ABACATEPAY_WEBHOOK_SECRET;
    if (webhookSecret) {
        const received = req.headers['x-webhook-secret'] ?? req.headers['x-abacatepay-secret'] ?? req.headers['authorization']?.replace('Bearer ', '');
        if (received !== webhookSecret) {
            console.warn('[Webhook AbacatePay] Secret inválido — requisição rejeitada');
            return res.status(401).json({ error: 'Unauthorized' });
        }
    }

    const body = req.body ?? {};
    const billing = body.billing ?? body.data?.checkout ?? body.data ?? body;
    const status = billing?.status;
    const metadata = billing?.metadata ?? {};

    console.log('[Webhook AbacatePay] evento recebido:', JSON.stringify({ status, metadata }).slice(0, 300));

    if (status !== 'PAID' && status !== 'COMPLETED') {
        return res.json({ ok: true, skipped: true });
    }

    const { userId, billingType, origin, destination } = metadata;

    if (origin !== 'PLANO' || !userId) {
        return res.json({ ok: true, skipped: true });
    }

    const plan = ['essencial', 'pro', 'elite'].find(p => (destination ?? '').toLowerCase().includes(p));
    if (!plan) {
        console.error('[Webhook AbacatePay] Plano não identificado em destination:', destination);
        return res.status(400).json({ error: 'Plano não identificado' });
    }

    if (!supabase) {
        console.error('[Webhook AbacatePay] Supabase não configurado');
        return res.status(500).json({ error: 'Supabase não configurado' });
    }

    const daysToAdd = billingType === 'anual' ? 365 : 30;
    const expiresAt = new Date(Date.now() + daysToAdd * 24 * 60 * 60 * 1000).toISOString();

    const { error } = await supabase.from('user_profiles').upsert({
        id: userId,
        plan,
        plan_expires_at: expiresAt,
        plan_billing: billingType ?? 'mensal',
    });

    if (error) {
        console.error('[Webhook AbacatePay] Erro ao ativar plano:', error);
        return res.status(500).json({ error: error.message });
    }

    console.log(`[Webhook AbacatePay] Plano ${plan} ativado para usuário ${userId}`);

    const amountCents = billing?.products?.[0]?.price ?? billing?.amount ?? null;
    sendWelcomeEmail({ userId, plan, billingType: billingType ?? 'mensal', expiresAt, billingId: billing?.id, amountCents }).catch(() => {});

    res.json({ ok: true });
});

router.post('/api/checkout/activate', async (req, res) => {
    const { billingId, userId } = req.body;
    if (!billingId || !userId) {
        return res.status(400).json({ error: 'billingId e userId são obrigatórios' });
    }

    try {
        const abRes = await fetch(`${ABACATEPAY_BASE}/billing/list`, {
            headers: { 'Authorization': `Bearer ${ABACATEPAY_API_KEY}` },
            signal: AbortSignal.timeout(10000),
        });
        const abData = await abRes.json();
        const billings = Array.isArray(abData.data) ? abData.data : [];
        const d = billings.find(b => b.id === billingId) ?? {};

        if (d.status !== 'PAID' && d.status !== 'COMPLETED') {
            return res.status(402).json({ error: 'Pagamento ainda não confirmado', status: d.status ?? 'NOT_FOUND' });
        }

        const metadata = d.metadata ?? {};
        const { billingType, origin, destination } = metadata;

        if (origin !== 'PLANO' || !destination) {
            return res.status(400).json({ error: 'Cobrança não é de plano' });
        }

        const plan = ['essencial', 'pro', 'elite'].find(p => destination.toLowerCase().includes(p));
        if (!plan) {
            return res.status(400).json({ error: 'Plano não identificado: ' + destination });
        }

        if (!supabase) {
            return res.status(500).json({ error: 'Supabase não configurado no servidor' });
        }

        const daysToAdd = billingType === 'anual' ? 365 : 30;
        const expiresAt = new Date(Date.now() + daysToAdd * 24 * 60 * 60 * 1000).toISOString();

        const { error } = await supabase.from('user_profiles').upsert({
            id: userId,
            plan,
            plan_expires_at: expiresAt,
            plan_billing: billingType ?? 'mensal',
        });

        if (error) {
            console.error('[Activate] Erro ao ativar plano:', error);
            return res.status(500).json({ error: error.message });
        }

        console.log(`[Activate] Plano ${plan} ativado para ${userId}`);

        const amountCents = d.products?.[0]?.price ?? d.amount ?? null;
        sendWelcomeEmail({ userId, plan, billingType: billingType ?? 'mensal', expiresAt, billingId: billingId, amountCents }).catch(() => {});

        res.json({ ok: true, plan, plan_expires_at: expiresAt });
    } catch (err) {
        console.error('[Activate] Exceção:', err.message);
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/checkout/tokenize', async (req, res) => {
    const { cardNumber, cardHolder, expiryMonth, expiryYear, cvv } = req.body ?? {};
    if (!cardNumber || !cardHolder || !expiryMonth || !expiryYear || !cvv) {
        return res.status(400).json({ error: 'Dados do cartão incompletos' });
    }
    try {
        const r = await fetch(`${ABACATEPAY_BASE}/card/tokenize`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${ABACATEPAY_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                cardNumber: cardNumber.replace(/\s/g, ''),
                holderName: cardHolder,
                expiryMonth,
                expiryYear,
                cvv,
            }),
            signal: AbortSignal.timeout(15000),
        });
        const data = await r.json();
        if (!r.ok) {
            console.error('[Tokenize] AbacatePay erro:', data);
            return res.status(r.status).json({ error: data.error || 'Erro ao tokenizar cartão', fallbackToUrl: true });
        }
        res.json({ token: data.data?.token ?? data.token });
    } catch (err) {
        console.error('[Tokenize] Exceção:', err.message);
        res.status(500).json({ error: err.message, fallbackToUrl: true });
    }
});

router.post('/api/user/cancel-plan', requireUserJWT, async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase indisponível' });
    const { reason, reasonDetail } = req.body ?? {};
    if (!reason) return res.status(400).json({ error: 'reason é obrigatório' });

    const { data: profile } = await supabase
        .from('user_profiles')
        .select('plan')
        .eq('id', req.userId)
        .single();

    const { error: upErr } = await supabase
        .from('user_profiles')
        .update({ plan: null, plan_expires_at: null, plan_billing: null })
        .eq('id', req.userId);

    if (upErr) {
        console.error('[CancelPlan] Erro ao cancelar plano:', upErr);
        return res.status(500).json({ error: upErr.message });
    }

    await supabase.from('plan_cancellations').insert({
        user_id: req.userId,
        plan: profile?.plan ?? null,
        reason,
        reason_detail: reasonDetail ?? null,
    });

    console.log(`[CancelPlan] Plano cancelado para ${req.userId} — motivo: ${reason}`);
    res.json({ ok: true });
});

export default router;
