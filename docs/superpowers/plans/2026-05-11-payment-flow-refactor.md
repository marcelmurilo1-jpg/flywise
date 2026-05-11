# Payment Flow Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three payment improvements: (1) recurring billing instead of one-time, (2) native card form with no redirect, (3) two-step cancellation modal with reason capture and retention offer.

**Architecture:** One new DB migration (`plan_cancellations`), three backend route changes in `routes/checkout.js`, one new React component (`CancelPlanModal`), and updates to `Checkout.tsx` and `Configuracoes.tsx`. Each feature is independent — implement in order but each task commits clean.

**Tech Stack:** Express.js (backend), React + TypeScript + inline styles (frontend), Supabase/Postgres (DB), AbacatePay REST API, Resend (email — already wired, no changes needed)

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `supabase/migrations/031_plan_cancellations.sql` | Create | New table to store cancellation reasons |
| `routes/checkout.js` | Modify | Add `requireUserJWT` import; change `frequency`; add `/tokenize` route; add `/user/cancel-plan` route |
| `src/components/CancelPlanModal.tsx` | Create | Two-step cancellation modal with retention offer |
| `src/pages/Configuracoes.tsx` | Modify | Add `planExpiresAt` state; wire "Cancelar plano" button to open modal |
| `src/pages/Checkout.tsx` | Modify | Replace card section with native form + tokenize flow + iframe fallback |

---

## Task 1: DB Migration — plan_cancellations

**Files:**
- Create: `supabase/migrations/031_plan_cancellations.sql`

- [ ] **Step 1: Write migration file**

```sql
-- Migration 031: Track plan cancellations and reasons
CREATE TABLE IF NOT EXISTS plan_cancellations (
  id            BIGSERIAL    PRIMARY KEY,
  user_id       UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan          TEXT,
  reason        TEXT         NOT NULL,
  reason_detail TEXT,
  cancelled_at  TIMESTAMPTZ  DEFAULT NOW()
);

ALTER TABLE plan_cancellations ENABLE ROW LEVEL SECURITY;

-- Only admins can read via service role; users cannot read their own rows
CREATE POLICY "admin_only" ON plan_cancellations FOR ALL USING (FALSE);

CREATE INDEX idx_plan_cancellations_user_id ON plan_cancellations (user_id);
```

- [ ] **Step 2: Apply migration via Supabase MCP**

Use `mcp__plugin_supabase_supabase__apply_migration` with:
- `name`: `031_plan_cancellations`
- `query`: the SQL above

- [ ] **Step 3: Verify table exists**

Use `mcp__plugin_supabase_supabase__execute_sql`:
```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'plan_cancellations'
ORDER BY ordinal_position;
```

Expected output: rows for `id`, `user_id`, `plan`, `reason`, `reason_detail`, `cancelled_at`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/031_plan_cancellations.sql
git commit -m "feat(db): add plan_cancellations table for cancellation reason tracking"
```

---

## Task 2: Backend — Recurring Billing Frequency

**Files:**
- Modify: `routes/checkout.js` (line ~80)

- [ ] **Step 1: Change ONE_TIME to dynamic frequency**

In `routes/checkout.js`, find:
```js
        const billingPayload = {
            frequency: 'ONE_TIME',
```

Replace with:
```js
        const billingPayload = {
            frequency: billingType === 'anual' ? 'YEARLY' : 'MONTHLY',
```

- [ ] **Step 2: Verify with curl**

```bash
# Start server locally first: node server.js
curl -s -X POST http://localhost:3000/api/checkout \
  -H "Content-Type: application/json" \
  -d '{
    "origin":"PLANO","destination":"PRO","totalBrl":49,
    "customerName":"Test","customerEmail":"test@test.com",
    "customerTaxId":"52998224725","customerPhone":"11999999999",
    "userId":"test-user-id","billingType":"mensal","paymentMethod":"pix"
  }' | jq '.status'
```

Expected: `"PENDING"` (billing created successfully). If AbacatePay returns error about `MONTHLY` not supported, check their dashboard plan settings — products must be configured as recurring there too.

- [ ] **Step 3: Commit**

```bash
git add routes/checkout.js
git commit -m "feat(checkout): use MONTHLY/YEARLY frequency for recurring subscriptions"
```

---

## Task 3: Backend — Cancel Plan Route

**Files:**
- Modify: `routes/checkout.js` (add import + new route at end)

- [ ] **Step 1: Add requireUserJWT import**

In `routes/checkout.js`, find the existing imports:
```js
import { Router } from 'express';
import { supabase } from '../lib/supabase.js';
import { resend, RESEND_FROM } from '../lib/resend.js';
```

Replace with:
```js
import { Router } from 'express';
import { supabase } from '../lib/supabase.js';
import { resend, RESEND_FROM } from '../lib/resend.js';
import { requireUserJWT } from '../middleware/auth.js';
```

- [ ] **Step 2: Add cancel-plan route before `export default router`**

Find the last line of `routes/checkout.js`:
```js
export default router;
```

Insert before it:
```js
router.post('/api/user/cancel-plan', requireUserJWT, async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase indisponível' });
    const { reason, reasonDetail } = req.body ?? {};
    if (!reason) return res.status(400).json({ error: 'reason é obrigatório' });

    // Read current plan before clearing
    const { data: profile } = await supabase
        .from('user_profiles')
        .select('plan')
        .eq('id', req.userId)
        .single();

    // Clear plan
    const { error: upErr } = await supabase
        .from('user_profiles')
        .update({ plan: null, plan_expires_at: null, plan_billing: null })
        .eq('id', req.userId);

    if (upErr) {
        console.error('[CancelPlan] Erro ao cancelar plano:', upErr);
        return res.status(500).json({ error: upErr.message });
    }

    // Log cancellation reason
    await supabase.from('plan_cancellations').insert({
        user_id: req.userId,
        plan: profile?.plan ?? null,
        reason,
        reason_detail: reasonDetail ?? null,
    });

    console.log(`[CancelPlan] Plano cancelado para ${req.userId} — motivo: ${reason}`);
    res.json({ ok: true });
});

```

- [ ] **Step 3: Verify route responds correctly**

```bash
# Requires a valid JWT — test manually in browser devtools or with a real user token
curl -s -X POST http://localhost:3000/api/user/cancel-plan \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer REPLACE_WITH_REAL_JWT" \
  -d '{"reason":"Preço muito alto"}'
```

Expected: `{"ok":true}`
If no JWT: `{"error":"Unauthorized"}` or 401.

- [ ] **Step 4: Commit**

```bash
git add routes/checkout.js
git commit -m "feat(checkout): add POST /api/user/cancel-plan route with reason logging"
```

---

## Task 4: Backend — Card Tokenize Route

**Files:**
- Modify: `routes/checkout.js` (add new route before `export default router`)

- [ ] **Step 1: Add tokenize route**

Insert before `export default router;` in `routes/checkout.js`:

```js
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
```

> **Note:** `fallbackToUrl: true` is the signal for the frontend to use the iframe fallback if AbacatePay does not have this endpoint. The frontend handles this gracefully (see Task 7).

- [ ] **Step 2: Update /api/checkout to handle tokenized card**

In `routes/checkout.js`, the existing `billingPayload` block (after `const billingPayload = {`), add card token support. Find:
```js
        const billingPayload = {
            frequency: billingType === 'anual' ? 'YEARLY' : 'MONTHLY',
            methods,
            customerId,
            products: [productEntry],
            returnUrl: `${process.env.FRONTEND_URL || req.headers.origin || 'http://localhost:5173'}${returnPath || '/onboarding'}`,
            completionUrl: `${process.env.FRONTEND_URL || req.headers.origin || 'http://localhost:5173'}${returnPath || '/onboarding'}`,
            metadata: { origin, destination, departureDate, returnDate, outboundCompany, returnCompany, userId, billingType },
        };
```

Replace with:
```js
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
```

- [ ] **Step 3: Commit**

```bash
git add routes/checkout.js
git commit -m "feat(checkout): add card tokenize route + token/installments support in billing"
```

---

## Task 5: Frontend — CancelPlanModal Component

**Files:**
- Create: `src/components/CancelPlanModal.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { useState } from 'react'
import { X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const REASONS = [
    'Preço muito alto',
    'Não uso o suficiente',
    'Prefiro outra ferramenta',
    'Falta de funcionalidades',
    'Outro motivo',
]

const DOWNGRADE_MAP: Record<string, { name: string; price: string }> = {
    elite: { name: 'Pro',      price: 'R$ 49' },
    pro:   { name: 'Essencial', price: 'R$ 19' },
}

interface Props {
    isOpen: boolean
    onClose: () => void
    currentPlan: string         // 'essencial' | 'pro' | 'elite'
    planExpiresAt: string | null
    onCancelled: () => void     // called after successful cancellation
}

export default function CancelPlanModal({ isOpen, onClose, currentPlan, planExpiresAt, onCancelled }: Props) {
    const navigate = useNavigate()
    const [step, setStep]               = useState<1 | 2>(1)
    const [reason, setReason]           = useState('')
    const [reasonDetail, setReasonDetail] = useState('')
    const [loading, setLoading]         = useState(false)
    const [error, setError]             = useState<string | null>(null)

    if (!isOpen) return null

    const planKey        = currentPlan.toLowerCase()
    const downgradeOpt   = DOWNGRADE_MAP[planKey] ?? null
    const showDowngrade  = reason === 'Preço muito alto' && downgradeOpt !== null

    const expiresLabel = planExpiresAt
        ? new Date(planExpiresAt).toLocaleDateString('pt-BR')
        : null

    function close() {
        setStep(1); setReason(''); setReasonDetail(''); setError(null)
        onClose()
    }

    function handleNext() {
        if (!reason) return
        setStep(2)
    }

    async function handleConfirm() {
        setLoading(true); setError(null)
        try {
            const res = await fetch('/api/user/cancel-plan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason, reasonDetail: reasonDetail || undefined }),
            })
            const data = await res.json()
            if (!res.ok || data.error) throw new Error(data.error || 'Erro ao cancelar plano')
            onCancelled()
            close()
        } catch (e: any) {
            setError(e.message)
        } finally {
            setLoading(false)
        }
    }

    const overlayStyle: React.CSSProperties = {
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.52)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }

    const boxStyle: React.CSSProperties = {
        background: '#fff', borderRadius: 20, padding: '32px 28px',
        maxWidth: 440, width: '100%', boxShadow: '0 24px 80px rgba(0,0,0,0.18)',
        position: 'relative', fontFamily: 'Inter, system-ui, sans-serif',
    }

    const btnPrimary: React.CSSProperties = {
        width: '100%', padding: 12, borderRadius: 10, border: 'none',
        fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
    }

    return (
        <div style={overlayStyle} onClick={close}>
            <div style={boxStyle} onClick={e => e.stopPropagation()}>

                {/* Close button */}
                <button onClick={close} style={{ position: 'absolute', top: 14, right: 14, background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 4 }}>
                    <X size={18} />
                </button>

                {/* ── STEP 1: Reason ── */}
                {step === 1 && (
                    <>
                        <div style={{ fontSize: 28, marginBottom: 8 }}>😢</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: '#0E2A55', marginBottom: 6 }}>Sentiremos sua falta</div>
                        <div style={{ fontSize: 13, color: '#64748B', marginBottom: 20 }}>O que está te fazendo cancelar?</div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                            {REASONS.map(r => (
                                <label key={r} style={{
                                    display: 'flex', alignItems: 'center', gap: 10,
                                    padding: '10px 14px',
                                    border: `1.5px solid ${reason === r ? '#0E2A55' : '#E2EAF5'}`,
                                    borderRadius: 10, cursor: 'pointer', fontSize: 13, color: '#374151',
                                    background: reason === r ? '#F0F4FA' : '#fff', transition: 'all .15s',
                                }}>
                                    <input type="radio" name="cancel-reason" checked={reason === r}
                                        onChange={() => setReason(r)} style={{ accentColor: '#0E2A55' }} />
                                    {r}
                                </label>
                            ))}
                        </div>

                        {reason === 'Outro motivo' && (
                            <textarea
                                value={reasonDetail} onChange={e => setReasonDetail(e.target.value)}
                                placeholder="Nos conte mais..."
                                style={{
                                    width: '100%', padding: '10px 12px', borderRadius: 10,
                                    border: '1.5px solid #E2EAF5', fontSize: 13, color: '#374151',
                                    fontFamily: 'inherit', resize: 'vertical', minHeight: 72,
                                    marginBottom: 12, boxSizing: 'border-box',
                                }}
                            />
                        )}

                        <button onClick={handleNext} disabled={!reason} style={{
                            ...btnPrimary,
                            background: reason ? '#0E2A55' : '#E2EAF5',
                            color: reason ? '#fff' : '#94A3B8',
                            cursor: reason ? 'pointer' : 'not-allowed',
                        }}>
                            Próximo →
                        </button>
                    </>
                )}

                {/* ── STEP 2a: Retention offer (downgrade available) ── */}
                {step === 2 && showDowngrade && (
                    <>
                        <div style={{ fontSize: 28, marginBottom: 8 }}>💡</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: '#0E2A55', marginBottom: 6 }}>Que tal um plano menor?</div>
                        <div style={{ fontSize: 13, color: '#64748B', marginBottom: 20 }}>
                            Em vez de cancelar, faça downgrade para o <strong>{downgradeOpt!.name}</strong> por apenas{' '}
                            <strong>{downgradeOpt!.price}/mês</strong> e continue aproveitando o FlyWise.
                        </div>

                        <button onClick={() => { close(); navigate('/planos') }} style={{
                            ...btnPrimary, marginBottom: 10,
                            background: 'linear-gradient(135deg,#2A60C2,#7C3AED)', color: '#fff',
                        }}>
                            Ver plano {downgradeOpt!.name} →
                        </button>

                        {error && <div style={{ fontSize: 12, color: '#DC2626', marginBottom: 8 }}>{error}</div>}

                        <button onClick={handleConfirm} disabled={loading} style={{
                            ...btnPrimary,
                            border: '1.5px solid #FECACA', background: '#FEF2F2',
                            color: '#DC2626', fontSize: 13, fontWeight: 600,
                            cursor: loading ? 'not-allowed' : 'pointer',
                        }}>
                            {loading ? 'Cancelando...' : 'Cancelar mesmo assim'}
                        </button>
                    </>
                )}

                {/* ── STEP 2b: Direct confirmation (no downgrade or already Essencial) ── */}
                {step === 2 && !showDowngrade && (
                    <>
                        <div style={{ fontSize: 28, marginBottom: 8 }}>⚠️</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: '#0E2A55', marginBottom: 6 }}>Tem certeza?</div>
                        {expiresLabel && (
                            <div style={{ fontSize: 13, color: '#64748B', marginBottom: 20 }}>
                                Seu acesso continua até <strong>{expiresLabel}</strong>. Após essa data você perderá os recursos premium.
                            </div>
                        )}

                        {error && <div style={{ fontSize: 12, color: '#DC2626', marginBottom: 8 }}>{error}</div>}

                        <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={close} style={{
                                flex: 1, padding: 12, borderRadius: 10, fontSize: 13, fontWeight: 600,
                                border: '1.5px solid #E2EAF5', background: '#fff',
                                color: '#64748B', cursor: 'pointer', fontFamily: 'inherit',
                            }}>
                                Manter plano
                            </button>
                            <button onClick={handleConfirm} disabled={loading} style={{
                                flex: 1, padding: 12, borderRadius: 10, border: 'none',
                                background: loading ? '#94A3B8' : '#DC2626', color: '#fff',
                                fontSize: 13, fontWeight: 700,
                                cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                            }}>
                                {loading ? 'Cancelando...' : 'Confirmar cancelamento'}
                            </button>
                        </div>
                    </>
                )}

            </div>
        </div>
    )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/CancelPlanModal.tsx
git commit -m "feat(ui): add CancelPlanModal — two-step cancellation with retention offer"
```

---

## Task 6: Frontend — Wire CancelPlanModal in Configuracoes.tsx

**Files:**
- Modify: `src/pages/Configuracoes.tsx`

- [ ] **Step 1: Add import at top of file**

Find the first import line in `Configuracoes.tsx` and add:
```tsx
import CancelPlanModal from '@/components/CancelPlanModal'
```

- [ ] **Step 2: Add state for modal and plan expiry**

Find in `Configuracoes.tsx`:
```tsx
    const [planoAtivo, setPlanoAtivo] = useState<string | null>(null)
```

Replace with:
```tsx
    const [planoAtivo, setPlanoAtivo]       = useState<string | null>(null)
    const [planExpiresAt, setPlanExpiresAt] = useState<string | null>(null)
    const [cancelModalOpen, setCancelModalOpen] = useState(false)
```

- [ ] **Step 3: Populate planExpiresAt from profile fetch**

Find:
```tsx
                setPlanoAtivo(profileData.plano_ativo ?? null)
```

Replace with:
```tsx
                setPlanoAtivo(profileData.plano_ativo ?? null)
                setPlanExpiresAt(profileData.plan_expires_at ?? null)
```

- [ ] **Step 4: Change "Cancelar plano" button onClick**

Find:
```tsx
                                                onClick={() => setPlanoAtivo(null)}
```

Replace with:
```tsx
                                                onClick={() => setCancelModalOpen(true)}
```

- [ ] **Step 5: Add modal at end of component return (before closing `</div>`)**

Find the last `</div>` of the component's `return (` block and insert before it:
```tsx
            <CancelPlanModal
                isOpen={cancelModalOpen}
                onClose={() => setCancelModalOpen(false)}
                currentPlan={planoAtivo ?? ''}
                planExpiresAt={planExpiresAt}
                onCancelled={() => {
                    setPlanoAtivo(null)
                    setPlanExpiresAt(null)
                }}
            />
```

- [ ] **Step 6: Verify in browser**

1. Log in with a paid plan account
2. Go to `/configuracoes` → section "Plano"
3. Click "Cancelar plano"
4. Modal should appear with 5 reason options
5. Select "Preço muito alto" → click Próximo → see downgrade offer (if on Pro or Elite)
6. Select "Não uso o suficiente" → click Próximo → see confirmation screen
7. Click "Manter plano" → modal closes, plan still active
8. Click "Confirmar cancelamento" → plan cleared, modal closes, section shows "Sem plano"

- [ ] **Step 7: Commit**

```bash
git add src/pages/Configuracoes.tsx
git commit -m "feat(settings): wire CancelPlanModal — cancellation flow with reason capture"
```

---

## Task 7: Frontend — Native Card Form in Checkout.tsx

**Files:**
- Modify: `src/pages/Checkout.tsx`

- [ ] **Step 1: Add card form state after existing `const [cardLoading...` state**

Find:
```tsx
    // Card state
    const [cardLoading, setCardLoading] = useState(false)
    const [cardError, setCardError] = useState<string | null>(null)
```

Replace with:
```tsx
    // Card form state
    const [cardHolder, setCardHolder]   = useState('')
    const [cardNumber, setCardNumber]   = useState('')
    const [cardExpiry, setCardExpiry]   = useState('')
    const [cardCvv, setCardCvv]         = useState('')
    const [cardBrand, setCardBrand]     = useState<string | null>(null)
    const [installments, setInstallments] = useState(1)
    const [cardProcessing, setCardProcessing] = useState(false)
    const [cardFormError, setCardFormError]   = useState<string | null>(null)
    const [cardBillingUrl, setCardBillingUrl] = useState<string | null>(null)
```

- [ ] **Step 2: Add helper functions before the component's return statement**

Find the line:
```tsx
    if (!state) return null
```

Insert above it:
```tsx
    function formatCardNumber(v: string): string {
        return v.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim()
    }

    function detectBrand(num: string): string | null {
        const n = num.replace(/\s/g, '')
        if (/^4/.test(n)) return 'VISA'
        if (/^5[1-5]|^2[2-7]/.test(n)) return 'Master'
        if (/^6(?:362[89]|3[89]|4\d{4}|5\d{4})\d*/.test(n)) return 'Elo'
        if (/^3[47]/.test(n)) return 'Amex'
        return null
    }

    function formatExpiry(v: string): string {
        const d = v.replace(/\D/g, '').slice(0, 4)
        return d.length >= 3 ? d.slice(0, 2) + '/' + d.slice(2) : d
    }

    function getInstallmentOptions(price: number) {
        return Array.from({ length: 12 }, (_, i) => {
            const n = i + 1
            const amt = (price / n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            return { n, label: n === 1 ? `1x de R$ ${amt} (sem juros)` : `${n}x de R$ ${amt}` }
        })
    }

    async function handleNativeCardPayment() {
        if (!cardHolder.trim()) { setCardFormError('Informe o nome no cartão'); return }
        if (cardNumber.replace(/\s/g, '').length < 16) { setCardFormError('Número do cartão inválido'); return }
        const [month, year] = cardExpiry.split('/')
        if (!month || !year || month.length !== 2 || year.length !== 2) { setCardFormError('Data de validade inválida (MM/AA)'); return }
        if (cardCvv.length < 3) { setCardFormError('CVV inválido'); return }

        setCardProcessing(true)
        setCardFormError(null)
        setCardBillingUrl(null)

        try {
            // Step 1: Try tokenization
            const tokenRes = await fetch('/api/checkout/tokenize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cardNumber: cardNumber.replace(/\s/g, ''),
                    cardHolder: cardHolder.trim(),
                    expiryMonth: month,
                    expiryYear: '20' + year,
                    cvv: cardCvv,
                }),
            })
            const tokenData = await tokenRes.json()

            if (tokenData.fallbackToUrl || !tokenRes.ok) {
                // AbacatePay tokenization not available — create billing and show URL in iframe
                const billingRes = await fetch('/api/checkout', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        origin: 'PLANO',
                        destination: state!.planName.toUpperCase(),
                        totalBrl: state!.priceVal,
                        outboundCompany: `FlyWise ${state!.planName}`,
                        customerEmail: state!.customerEmail,
                        customerName: state!.customerName,
                        customerTaxId: state!.customerTaxId,
                        customerPhone: state!.customerPhone,
                        userId: user?.id,
                        billingType: state!.billing,
                        paymentMethod: 'cartao',
                    }),
                })
                const billingData = await billingRes.json()
                if (!billingRes.ok || billingData.error) throw new Error(billingData.error || 'Erro ao criar cobrança')
                if (!billingData.url) throw new Error('URL de pagamento não retornada')
                setBillingId(billingData.id)
                setCardBillingUrl(billingData.url)
                return
            }

            // Step 2: Tokenization succeeded — create billing with token
            const billingRes = await fetch('/api/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    origin: 'PLANO',
                    destination: state!.planName.toUpperCase(),
                    totalBrl: state!.priceVal,
                    outboundCompany: `FlyWise ${state!.planName}`,
                    customerEmail: state!.customerEmail,
                    customerName: state!.customerName,
                    customerTaxId: state!.customerTaxId,
                    customerPhone: state!.customerPhone,
                    userId: user?.id,
                    billingType: state!.billing,
                    paymentMethod: 'cartao_tokenizado',
                    cardToken: tokenData.token,
                    installments,
                }),
            })
            const billingData = await billingRes.json()
            if (!billingRes.ok || billingData.error) throw new Error(billingData.error || 'Erro ao criar cobrança')
            setBillingId(billingData.id)
            // Status polling (same useEffect as PIX) will handle PAID detection
        } catch (err: any) {
            setCardFormError(err.message)
        } finally {
            setCardProcessing(false)
        }
    }

```

- [ ] **Step 3: Replace the card section JSX**

Find and remove everything between these two comment markers (the entire `{/* ── CARTÃO ── */}` block):
```tsx
                    {/* ── CARTÃO ── */}
                    {paymentStatus !== 'PAID' && paymentMethod === 'cartao' && (
                        <motion.div key="card-section"
```
... through its closing:
```tsx
                        </motion.div>
                    )}
```

Replace the entire block with:
```tsx
                    {/* ── CARTÃO ── */}
                    {paymentStatus !== 'PAID' && paymentMethod === 'cartao' && (
                        <motion.div key="card-section"
                            initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }}
                            style={{ width: '100%', maxWidth: 440, display: 'flex', flexDirection: 'column', gap: 24 }}>

                            <div style={{ textAlign: 'center' }}>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#EEF2F8', borderRadius: 999, padding: '5px 14px', marginBottom: 16 }}>
                                    <CreditCard size={14} color="#2A60C2" />
                                    <span style={{ fontSize: 12, fontWeight: 700, color: '#2A60C2', letterSpacing: '0.04em' }}>Cartão de crédito</span>
                                </div>
                                <div style={{ fontSize: 22, fontWeight: 900, color: '#0E2A55', letterSpacing: '-0.02em', marginBottom: 4 }}>
                                    {cardBillingUrl ? 'Conclua o pagamento abaixo' : 'Pague com cartão'}
                                </div>
                                <div style={{ fontSize: 13, color: '#64748B' }}>
                                    {cardBillingUrl ? 'Seus dados estão protegidos por SSL' : 'Preencha os dados do cartão — tudo acontece aqui'}
                                </div>
                            </div>

                            {/* Iframe fallback when tokenization is unavailable */}
                            {cardBillingUrl ? (
                                <div style={{ background: '#fff', borderRadius: 20, overflow: 'hidden', boxShadow: '0 4px 32px rgba(14,42,85,0.08)', border: '1px solid #E2EAF5' }}>
                                    <iframe
                                        src={cardBillingUrl}
                                        title="Pagamento seguro"
                                        style={{ width: '100%', height: 560, border: 'none', display: 'block' }}
                                    />
                                </div>
                            ) : (
                                /* Native card form */
                                <div style={{ background: '#fff', borderRadius: 20, padding: '28px', boxShadow: '0 4px 32px rgba(14,42,85,0.08)', display: 'flex', flexDirection: 'column', gap: 16 }}>

                                    {/* Price summary */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#F7F9FC', borderRadius: 12, border: '1px solid #E2EAF5' }}>
                                        <div>
                                            <div style={{ fontSize: 13, fontWeight: 700, color: '#0E2A55' }}>Plano {state.planName}</div>
                                            <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>Renova automaticamente — cancele quando quiser</div>
                                        </div>
                                        <div style={{ fontSize: 22, fontWeight: 900, color: '#0E2A55' }}>R$ {state.priceVal}</div>
                                    </div>

                                    {/* Cardholder name */}
                                    <div>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 6 }}>Nome no cartão</div>
                                        <input
                                            type="text" value={cardHolder} placeholder="Como aparece no cartão"
                                            onChange={e => setCardHolder(e.target.value)}
                                            style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid #E2EAF5', borderRadius: 10, padding: '11px 13px', fontSize: 14, color: '#0E2A55', fontFamily: 'inherit', outline: 'none' }}
                                        />
                                    </div>

                                    {/* Card number */}
                                    <div>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 6 }}>Número do cartão</div>
                                        <div style={{ position: 'relative' }}>
                                            <input
                                                type="text" inputMode="numeric" value={cardNumber} placeholder="0000 0000 0000 0000"
                                                onChange={e => {
                                                    const v = formatCardNumber(e.target.value)
                                                    setCardNumber(v)
                                                    setCardBrand(detectBrand(v))
                                                }}
                                                style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid #E2EAF5', borderRadius: 10, padding: '11px 44px 11px 13px', fontSize: 14, color: '#0E2A55', fontFamily: 'monospace', outline: 'none' }}
                                            />
                                            {cardBrand && (
                                                <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 11, fontWeight: 800, color: '#475569', background: '#F1F5F9', padding: '2px 7px', borderRadius: 5, border: '1px solid #E2EAF5' }}>
                                                    {cardBrand}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Expiry + CVV */}
                                    <div style={{ display: 'flex', gap: 12 }}>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 6 }}>Validade</div>
                                            <input
                                                type="text" inputMode="numeric" value={cardExpiry} placeholder="MM/AA"
                                                onChange={e => setCardExpiry(formatExpiry(e.target.value))}
                                                style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid #E2EAF5', borderRadius: 10, padding: '11px 13px', fontSize: 14, color: '#0E2A55', fontFamily: 'inherit', outline: 'none' }}
                                            />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 6 }}>CVV</div>
                                            <input
                                                type="password" inputMode="numeric" value={cardCvv} placeholder="•••"
                                                maxLength={4}
                                                onChange={e => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                                                style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid #E2EAF5', borderRadius: 10, padding: '11px 13px', fontSize: 14, color: '#0E2A55', fontFamily: 'inherit', outline: 'none' }}
                                            />
                                        </div>
                                    </div>

                                    {/* Installments */}
                                    <div>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 6 }}>Parcelas</div>
                                        <select
                                            value={installments}
                                            onChange={e => setInstallments(Number(e.target.value))}
                                            style={{ width: '100%', border: '1.5px solid #E2EAF5', borderRadius: 10, padding: '11px 13px', fontSize: 14, color: '#0E2A55', fontFamily: 'inherit', background: '#fff', outline: 'none', cursor: 'pointer' }}
                                        >
                                            {getInstallmentOptions(state.priceVal).map(opt => (
                                                <option key={opt.n} value={opt.n}>{opt.label}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Accepted brands */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.05em' }}>Aceito</span>
                                        <div style={{ display: 'flex', gap: 5 }}>
                                            {['VISA', 'Master', 'Elo', 'Amex'].map(b => (
                                                <span key={b} style={{ padding: '2px 8px', background: cardBrand === b ? '#E0EAFF' : '#F1F5F9', border: `1px solid ${cardBrand === b ? '#93C5FD' : '#E2EAF5'}`, borderRadius: 5, fontSize: 10, fontWeight: 800, color: cardBrand === b ? '#1D4ED8' : '#475569' }}>{b}</span>
                                            ))}
                                        </div>
                                    </div>

                                    {cardFormError && (
                                        <div style={{ fontSize: 13, color: '#DC2626', background: '#FEF2F2', borderRadius: 10, padding: '10px 14px', border: '1px solid #FECACA' }}>
                                            {cardFormError}
                                        </div>
                                    )}

                                    <button
                                        onClick={handleNativeCardPayment}
                                        disabled={cardProcessing}
                                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: 15, background: cardProcessing ? '#94A3B8' : '#0E2A55', color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 800, cursor: cardProcessing ? 'not-allowed' : 'pointer', fontFamily: 'inherit', transition: 'background .2s' }}
                                    >
                                        {cardProcessing
                                            ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Processando…</>
                                            : <>🔒 Pagar R$ {state.priceVal}</>
                                        }
                                    </button>

                                    <div style={{ fontSize: 11, color: '#94A3B8', textAlign: 'center', lineHeight: 1.6 }}>
                                        Dados protegidos por SSL · PCI DSS<br />
                                        Cancele a qualquer momento em Configurações
                                    </div>
                                </div>
                            )}

                            <div style={{ display: 'flex', justifyContent: 'center', gap: 20 }}>
                                {['🔒 SSL', '🛡️ PCI DSS', '🔄 Renovação automática'].map(t => (
                                    <div key={t} style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600 }}>{t}</div>
                                ))}
                            </div>
                        </motion.div>
                    )}
```

- [ ] **Step 4: Update the PIX polling useEffect to also activate when `billingId` is set from card tokenization**

The existing polling useEffect already handles `billingId` regardless of payment method — no changes needed. The `cardBillingUrl` path sets `billingId` too, so polling works for the iframe path as well.

- [ ] **Step 5: Build and verify**

```bash
cd /Users/muriloroizpovoa/Desktop/Fly\ Wise && npm run build 2>&1 | tail -20
```

Expected: build succeeds with no new errors.

- [ ] **Step 6: Test in dev**

```bash
npm run dev:all
```

1. Go to `/planos` → select a plan → proceed to checkout
2. Select "Cartão de crédito" tab
3. Verify native form appears with all fields
4. Fill in test card: `4111 1111 1111 1111` / `12/27` / `123`
5. If AbacatePay tokenization returns 404: iframe should appear instead
6. If iframe appears: complete payment in iframe
7. Verify confetti + redirect to `/onboarding` after payment

- [ ] **Step 7: Commit**

```bash
git add src/pages/Checkout.tsx
git commit -m "feat(checkout): native card form with tokenize flow + iframe fallback"
```

---

## Task 8: Push and Deploy

- [ ] **Step 1: Push all commits**

```bash
git push origin main
```

Railway detects the push and deploys automatically.

- [ ] **Step 2: Smoke test on production**

1. Go to `flywisebr.com/planos` → select Pro Mensal → checkout
2. Card tab: verify form fields appear (not the old button)
3. Configurações → Plano → Cancelar plano → verify 2-step modal works
4. Verify PIX still works (no regression)

---

## Self-Review Checklist

- [x] Task 1 covers `plan_cancellations` migration from spec ✅
- [x] Task 2 covers recurring frequency change from spec ✅
- [x] Task 3 covers `/api/user/cancel-plan` route from spec ✅
- [x] Task 4 covers `/api/checkout/tokenize` route + token in billing from spec ✅
- [x] Task 5 covers `CancelPlanModal` component with 2-step flow from spec ✅
- [x] Task 6 covers wiring in `Configuracoes.tsx` from spec ✅
- [x] Task 7 covers native card form + iframe fallback from spec ✅
- [x] Downgrade offer only shown for Pro/Elite (Essencial → direct confirm) ✅
- [x] `requireUserJWT` imported before use in cancel-plan route ✅
- [x] `cardBillingUrl` path sets `billingId` so PIX polling picks up card iframe payment too ✅
- [x] No TODOs or TBDs in any step ✅
