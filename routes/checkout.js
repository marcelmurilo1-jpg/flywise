import { Router } from 'express';
import { supabase } from '../lib/supabase.js';

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
            frequency: 'ONE_TIME',
            methods,
            customerId,
            products: [productEntry],
            returnUrl: `${process.env.FRONTEND_URL || req.headers.origin || 'http://localhost:5173'}${returnPath || '/onboarding'}`,
            completionUrl: `${process.env.FRONTEND_URL || req.headers.origin || 'http://localhost:5173'}${returnPath || '/onboarding'}`,
            metadata: { origin, destination, departureDate, returnDate, outboundCompany, returnCompany, userId, billingType },
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
        res.json({ ok: true, plan, plan_expires_at: expiresAt });
    } catch (err) {
        console.error('[Activate] Exceção:', err.message);
        res.status(500).json({ error: err.message });
    }
});

export default router;
