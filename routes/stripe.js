import { Router } from 'express';
import express from 'express';
import Stripe from 'stripe';
import { supabase } from '../lib/supabase.js';
import { resend, RESEND_FROM } from '../lib/resend.js';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

const STRIPE_PRICE_IDS = {
    essencial_mensal: process.env.STRIPE_PRICE_ESSENCIAL_MENSAL,
    essencial_anual:  process.env.STRIPE_PRICE_ESSENCIAL_ANUAL,
    pro_mensal:       process.env.STRIPE_PRICE_PRO_MENSAL,
    pro_anual:        process.env.STRIPE_PRICE_PRO_ANUAL,
    elite_mensal:     process.env.STRIPE_PRICE_ELITE_MENSAL,
    elite_anual:      process.env.STRIPE_PRICE_ELITE_ANUAL,
};

const PLAN_LABELS = { essencial: 'Essencial', pro: 'Pro', elite: 'Elite' };
const PLAN_FEATURES = {
    essencial: ['Busca de voos com milhas', 'Calculadora de transferências', '3 rotas no Watchlist'],
    pro:       ['Tudo do Essencial', '10 rotas no Watchlist', 'Estratégia personalizada IA', 'Alertas prioritários'],
    elite:     ['Tudo do Pro', 'Watchlist ilimitado', 'Chat IA exclusivo', 'Suporte VIP'],
};

// ─── POST /api/stripe/create-subscription ─────────────────────────────────────
const router = Router();

router.post('/api/stripe/create-subscription', async (req, res) => {
    if (!stripe) return res.status(503).json({ error: 'Stripe não configurado no servidor' });
    if (!supabase) return res.status(503).json({ error: 'Supabase indisponível' });

    const { userId, plan, billing, customerEmail, customerName, customerTaxId } = req.body ?? {};

    if (!userId || !plan || !billing) {
        return res.status(400).json({ error: 'userId, plan e billing são obrigatórios' });
    }
    if (!['essencial', 'pro', 'elite'].includes(plan)) {
        return res.status(400).json({ error: 'Plano inválido' });
    }
    if (!['mensal', 'anual'].includes(billing)) {
        return res.status(400).json({ error: 'billing inválido' });
    }

    const priceKey = `${plan}_${billing}`;
    const priceId = STRIPE_PRICE_IDS[priceKey];
    if (!priceId) {
        console.error('[Stripe] Price ID não configurado para', priceKey);
        return res.status(500).json({ error: `Price ID não configurado: ${priceKey}` });
    }

    try {
        // 1. Recupera ou cria Stripe Customer
        const { data: profile } = await supabase
            .from('user_profiles')
            .select('stripe_customer_id')
            .eq('id', userId)
            .single();

        let customerId = profile?.stripe_customer_id ?? null;

        if (customerId) {
            // Valida que o customer ainda existe na Stripe (em caso de modo test/live trocado)
            try {
                await stripe.customers.retrieve(customerId);
            } catch {
                customerId = null;
            }
        }

        if (!customerId) {
            const customer = await stripe.customers.create({
                email: customerEmail,
                name: customerName,
                metadata: { userId },
                ...(customerTaxId ? {
                    tax_id_data: [{ type: 'br_cpf', value: customerTaxId }],
                } : {}),
            });
            customerId = customer.id;

            await supabase
                .from('user_profiles')
                .upsert({ id: userId, stripe_customer_id: customerId });
        }

        // 2. Cria Subscription incompleta — Stripe retorna clientSecret do PaymentIntent
        // Parcelamento (BR-only) habilitado apenas para o plano anual: valor mínimo
        // viável (~R$144) + parcelamento mensal só faz sentido em assinaturas longas.
        const isAnnual = billing === 'anual';
        const subscription = await stripe.subscriptions.create({
            customer: customerId,
            items: [{ price: priceId }],
            payment_behavior: 'default_incomplete',
            payment_settings: {
                save_default_payment_method: 'on_subscription',
                payment_method_types: ['card'],
                ...(isAnnual ? {
                    payment_method_options: {
                        card: {
                            request_three_d_secure: 'automatic',
                            installments: { enabled: true },
                        },
                    },
                } : {}),
            },
            expand: ['latest_invoice.payment_intent'],
            metadata: { userId, plan, billing },
        });

        const paymentIntent = subscription.latest_invoice?.payment_intent;
        const clientSecret = paymentIntent?.client_secret;

        if (!clientSecret) {
            console.error('[Stripe] Subscription criada mas sem clientSecret:', subscription.id);
            return res.status(500).json({ error: 'PaymentIntent não retornou clientSecret' });
        }

        res.json({
            subscriptionId: subscription.id,
            clientSecret,
            customerId,
        });
    } catch (err) {
        console.error('[Stripe] Erro create-subscription:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ─── GET /api/stripe/subscription/:id/status ──────────────────────────────────
// Usado pelo frontend após confirmPayment para verificar se o webhook já ativou
router.get('/api/stripe/subscription/:id/status', async (req, res) => {
    if (!stripe) return res.status(503).json({ error: 'Stripe não configurado' });
    if (!supabase) return res.status(503).json({ error: 'Supabase indisponível' });

    try {
        const sub = await stripe.subscriptions.retrieve(req.params.id);
        const userId = sub.metadata?.userId;

        // Verifica se o user_profile já foi atualizado pelo webhook
        let planActive = false;
        if (userId) {
            const { data: profile } = await supabase
                .from('user_profiles')
                .select('plan, plan_expires_at, stripe_subscription_id')
                .eq('id', userId)
                .single();
            planActive = profile?.stripe_subscription_id === sub.id
                && profile?.plan !== null
                && profile?.plan !== 'free';
        }

        res.json({
            status: sub.status,
            planActive,
        });
    } catch (err) {
        console.error('[Stripe] Erro status:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ─── Email de boas-vindas (mesma estrutura do checkout.js) ────────────────────
async function sendWelcomeEmail({ userId, plan, billing, expiresAt, subscriptionId, amountCents }) {
    if (!resend || !supabase) return;
    try {
        const { data: { user } } = await supabase.auth.admin.getUserById(userId);
        if (!user?.email) return;

        const toEmail = user.email;
        const toName = user.user_metadata?.name ?? toEmail.split('@')[0] ?? 'viajante';
        const planLabel = PLAN_LABELS[plan] ?? plan;
        const billingLabel = billing === 'anual' ? 'Anual' : 'Mensal';
        const appUrl = process.env.FRONTEND_URL ?? 'https://flywisebr.com';
        const expiresLabel = new Date(expiresAt).toLocaleDateString('pt-BR');
        const amountLabel = amountCents ? `R$ ${(amountCents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : null;
        const features = PLAN_FEATURES[plan] ?? [];
        const paidAt = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

        const featureRows = features.map(f => `
          <tr><td style="padding:6px 0;font-size:14px;color:#374151;">
            <span style="color:#2A60C2;font-weight:700;margin-right:8px;">✓</span>${f}
          </td></tr>`).join('');

        const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<style>
  body{font-family:'Segoe UI',system-ui,sans-serif;background:#F7F9FC;margin:0;padding:24px 16px}
  .wrap{max-width:520px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 8px 48px rgba(14,42,85,.12)}
  .hdr{background:linear-gradient(135deg,#0E2A55,#2A60C2);padding:28px 32px 24px;text-align:center}
  .logo{font-size:22px;font-weight:900;color:#fff;letter-spacing:-.03em}
  .logo span{color:rgba(255,255,255,.5)}
  .tag{font-size:11px;color:rgba(255,255,255,.6);font-weight:600;letter-spacing:.06em;text-transform:uppercase;margin-top:4px}
  .banner{padding:24px 32px 20px;border-bottom:1px solid #E2EAF5}
  .ttl{font-size:22px;font-weight:900;color:#0E2A55;margin-bottom:6px}
  .sub{font-size:14px;color:#6B7A99;line-height:1.5}
  .badge{display:inline-block;background:linear-gradient(135deg,#0E2A55,#2A60C2);color:#fff;font-size:13px;font-weight:800;padding:6px 16px;border-radius:20px;margin-bottom:12px}
  .receipt{margin:20px 32px;background:#F7F9FC;border:1.5px solid #E2EAF5;border-radius:14px;padding:18px 20px}
  .cta{margin:20px 32px;text-align:center}
  .btn{display:inline-block;background:linear-gradient(135deg,#2A60C2,#1A4A9C);color:#fff;font-size:14px;font-weight:800;padding:14px 36px;border-radius:12px;text-decoration:none}
  .ftr{border-top:1px solid #E2EAF5;padding:16px 32px 20px;text-align:center;font-size:11px;color:#A0AECB;line-height:1.6}
  .ftr a{color:#2A60C2;text-decoration:none;font-weight:700}
</style></head><body><div class="wrap">
  <div class="hdr"><div class="logo">Fly<span>Wise</span></div><div class="tag">Confirmação de Assinatura</div></div>
  <div class="banner">
    <div style="font-size:40px;margin-bottom:12px;">🎉</div>
    <div class="badge">FlyWise ${planLabel} ${billingLabel}</div>
    <div class="ttl">Bem-vindo ao FlyWise, ${toName}!</div>
    <div class="sub">Sua assinatura foi confirmada. Você tem acesso completo ao plano <strong>${planLabel}</strong> com renovação automática.</div>
  </div>
  <div style="margin:20px 32px 4px;">
    <div style="font-size:11px;font-weight:700;color:#6B7A99;text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px;">O que está incluído</div>
    <table width="100%" cellpadding="0" cellspacing="0" border="0">${featureRows}</table>
  </div>
  <div class="receipt">
    <div style="font-size:11px;font-weight:700;color:#6B7A99;text-transform:uppercase;letter-spacing:.06em;margin-bottom:12px;">Recibo de Pagamento</div>
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td style="font-size:13px;color:#6B7A99;padding:4px 0;">Plano</td><td style="font-size:13px;color:#0E2A55;font-weight:700;text-align:right;padding:4px 0;">FlyWise ${planLabel} ${billingLabel}</td></tr>
      ${amountLabel ? `<tr><td style="font-size:13px;color:#6B7A99;padding:4px 0;">Valor pago</td><td style="font-size:13px;color:#0E2A55;font-weight:700;text-align:right;padding:4px 0;">${amountLabel}</td></tr>` : ''}
      <tr><td style="font-size:13px;color:#6B7A99;padding:4px 0;">Pagamento</td><td style="font-size:13px;color:#0E2A55;font-weight:700;text-align:right;padding:4px 0;">Cartão de crédito (Stripe)</td></tr>
      <tr><td style="font-size:13px;color:#6B7A99;padding:4px 0;">Data</td><td style="font-size:13px;color:#0E2A55;font-weight:700;text-align:right;padding:4px 0;">${paidAt}</td></tr>
      <tr><td style="font-size:13px;color:#6B7A99;padding:4px 0;">Próxima cobrança</td><td style="font-size:13px;color:#0E2A55;font-weight:700;text-align:right;padding:4px 0;">${expiresLabel}</td></tr>
      <tr><td style="font-size:13px;color:#6B7A99;padding:4px 0;">ID da assinatura</td><td style="font-size:11px;color:#6B7A99;text-align:right;padding:4px 0;word-break:break-all;">${subscriptionId ?? '—'}</td></tr>
    </table>
  </div>
  <div class="cta"><a href="${appUrl}" class="btn">Acessar FlyWise →</a></div>
  <div class="ftr">Dúvidas? <a href="mailto:suporte@flywise.app">suporte@flywise.app</a><br>FlyWise · Feito para quem viaja com inteligência</div>
</div></body></html>`;

        await resend.emails.send({
            from: RESEND_FROM,
            to: toEmail,
            subject: `🎉 Bem-vindo ao FlyWise ${planLabel}! Sua assinatura está ativa`,
            html,
        });
        console.log(`[Stripe] Email enviado para ${toEmail} — plano ${plan}`);
    } catch (e) {
        console.error('[Stripe] Erro ao enviar email:', e.message);
    }
}

// ─── POST /api/stripe/webhook ─────────────────────────────────────────────────
// IMPORTANTE: este endpoint usa express.raw (não JSON parsed) — registrado em server.js
// antes do express.json() global. Assinatura é validada com STRIPE_WEBHOOK_SECRET.
export const webhookHandler = async (req, res) => {
    if (!stripe) return res.status(503).json({ error: 'Stripe não configurado' });
    if (!STRIPE_WEBHOOK_SECRET) {
        console.error('[Stripe Webhook] STRIPE_WEBHOOK_SECRET não configurado');
        return res.status(500).json({ error: 'Webhook secret não configurado' });
    }

    const signature = req.headers['stripe-signature'];
    if (!signature) return res.status(400).json({ error: 'Missing signature' });

    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, signature, STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error('[Stripe Webhook] Falha na verificação de assinatura:', err.message);
        return res.status(400).json({ error: `Webhook signature error: ${err.message}` });
    }

    console.log(`[Stripe Webhook] ${event.type} — ${event.id}`);

    try {
        switch (event.type) {
            case 'invoice.payment_succeeded': {
                const invoice = event.data.object;
                if (invoice.billing_reason !== 'subscription_create' && invoice.billing_reason !== 'subscription_cycle') {
                    break; // Ignora invoices manuais ou outros
                }
                const subscriptionId = invoice.subscription;
                if (!subscriptionId) break;

                const sub = await stripe.subscriptions.retrieve(subscriptionId);
                const { userId, plan, billing } = sub.metadata ?? {};

                if (!userId || !plan) {
                    console.warn('[Stripe Webhook] invoice.payment_succeeded sem metadata válido:', sub.id);
                    break;
                }

                const expiresAt = new Date(sub.current_period_end * 1000).toISOString();
                const { error } = await supabase.from('user_profiles').upsert({
                    id: userId,
                    plan,
                    plan_expires_at: expiresAt,
                    plan_billing: billing ?? 'mensal',
                    stripe_customer_id: sub.customer,
                    stripe_subscription_id: sub.id,
                    payment_provider: 'stripe',
                });

                if (error) {
                    console.error('[Stripe Webhook] Erro ao ativar plano:', error);
                    return res.status(500).json({ error: error.message });
                }

                console.log(`[Stripe Webhook] Plano ${plan} ativado para ${userId} (sub ${sub.id})`);

                // Envia email apenas na primeira cobrança (subscription_create)
                if (invoice.billing_reason === 'subscription_create') {
                    sendWelcomeEmail({
                        userId, plan, billing: billing ?? 'mensal',
                        expiresAt, subscriptionId: sub.id,
                        amountCents: invoice.amount_paid,
                    }).catch(() => {});
                }
                break;
            }

            case 'customer.subscription.deleted': {
                const sub = event.data.object;
                const userId = sub.metadata?.userId;
                if (!userId) break;

                const { error } = await supabase.from('user_profiles')
                    .update({
                        plan: null,
                        plan_expires_at: null,
                        plan_billing: null,
                        stripe_subscription_id: null,
                    })
                    .eq('id', userId)
                    .eq('stripe_subscription_id', sub.id);

                if (error) console.error('[Stripe Webhook] Erro ao cancelar plano:', error);
                else console.log(`[Stripe Webhook] Plano cancelado para ${userId}`);
                break;
            }

            case 'invoice.payment_failed': {
                const invoice = event.data.object;
                console.warn(`[Stripe Webhook] Pagamento falhou — invoice ${invoice.id}, customer ${invoice.customer}`);
                // Stripe tentará novamente automaticamente conforme retry policy do Dashboard
                break;
            }

            default:
                // Evento não tratado — ack para evitar retry
                break;
        }

        res.json({ received: true });
    } catch (err) {
        console.error('[Stripe Webhook] Exceção:', err.message);
        res.status(500).json({ error: err.message });
    }
};

// Middleware raw body (usado em server.js)
export const webhookRawMiddleware = express.raw({ type: 'application/json' });

export default router;
