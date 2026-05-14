import { Router } from 'express';
import express from 'express';
import { supabase } from '../lib/supabase.js';
import { requireUserJWT } from '../middleware/auth.js';

// ─── PaymentProvider — stub para próxima integração ──────────────────────────
//
// Contrato que a próxima gateway (Pagar.me / Mercado Pago / Iugu / Asaas / etc)
// deve implementar. Os endpoints abaixo já estão expostos e respondem 503
// "Not Implemented" — basta plugar o provider concreto e remover o throw.
//
// Métodos esperados:
//   - createCheckout({ userId, plan, billing, customer, amountCents, metadata })
//       → { id, clientSecret?, pixCode?, qrCodeImg?, expiresAt?, status }
//   - getStatus(checkoutId) → { id, status: 'PENDING' | 'PAID' | 'EXPIRED' | 'FAILED' }
//   - activatePlan({ checkoutId, userId }) → ativa o plano no Supabase após confirmação
//   - webhookHandler(req, res) → handler Express para eventos do gateway
//   - webhookRawMiddleware → middleware Express para receber raw body (se a gateway
//       exigir verificação de assinatura HMAC sobre o body original)
//
// Quando integrar o novo gateway:
//   1. Crie lib/<gateway>.js exportando os métodos acima.
//   2. Importe e substitua o objeto `paymentProvider` abaixo.
//   3. Se a gateway tiver webhook com assinatura, registre o raw middleware em
//      server.js ANTES do express.json() global (mesmo padrão da antiga Stripe).
//
// ─────────────────────────────────────────────────────────────────────────────

const NOT_IMPLEMENTED = 'PaymentProvider ainda não foi integrado. Endpoint indisponível.';

const paymentProvider = {
    async createCheckout(_input) {
        throw new Error(NOT_IMPLEMENTED);
    },
    async getStatus(_checkoutId) {
        throw new Error(NOT_IMPLEMENTED);
    },
    async activatePlan(_input) {
        throw new Error(NOT_IMPLEMENTED);
    },
};

export const webhookRawMiddleware = express.raw({ type: 'application/json' });

export const webhookHandler = (_req, res) => {
    console.warn('[PaymentProvider] Webhook recebido mas nenhum gateway está integrado.');
    res.status(503).json({ error: NOT_IMPLEMENTED });
};

const router = Router();

router.post('/api/payments/checkout', async (req, res) => {
    try {
        const result = await paymentProvider.createCheckout(req.body ?? {});
        res.json(result);
    } catch (err) {
        res.status(503).json({ error: err.message });
    }
});

router.get('/api/payments/status/:id', async (req, res) => {
    try {
        const result = await paymentProvider.getStatus(req.params.id);
        res.json(result);
    } catch (err) {
        res.status(503).json({ error: err.message });
    }
});

router.post('/api/payments/activate', async (req, res) => {
    try {
        const result = await paymentProvider.activatePlan(req.body ?? {});
        res.json(result);
    } catch (err) {
        res.status(503).json({ error: err.message });
    }
});

// ─── Cancelamento de plano — independente do gateway ─────────────────────────
// Mantido aqui (era /api/user/cancel-plan no checkout.js antigo) porque não
// depende de provider — apenas zera os campos do user_profiles no Supabase.
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
