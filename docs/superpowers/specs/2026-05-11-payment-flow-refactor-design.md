# Payment Flow Refactor — Design Spec
**Date:** 2026-05-11
**Status:** Approved

## Overview

Three independent improvements to the FlyWise subscription and payment flow:
1. Switch AbacatePay billing from one-time to recurring (MONTHLY/YEARLY)
2. Embed a native card form in Checkout.tsx — no redirect to AbacatePay
3. Add a two-step cancellation modal in Configurações with reason capture and retention offer

---

## Feature 1 — Recurring Subscription

### Problem
`routes/checkout.js` creates every billing with `frequency: 'ONE_TIME'`. Subscriptions expire and the user must manually re-subscribe. AbacatePay never charges automatically on renewal.

### Solution
Change the `frequency` field in the billing payload to reflect the actual billing period:
- `billingType === 'anual'` → `'YEARLY'`
- `billingType === 'mensal'` (default) → `'MONTHLY'`

**File:** `routes/checkout.js` — `billingPayload.frequency`

**Manual step (outside code):** Reconfigure the six registered products in the AbacatePay dashboard as recurring subscription products. This cannot be done via API — it is a product-level setting in their dashboard. Product IDs are already defined in `ABACATEPAY_PRODUCT_IDS`.

### Data flow (unchanged)
AbacatePay webhook → `POST /api/webhook/abacatepay` → upsert `user_profiles` → send welcome email. Renewal webhooks follow the same path automatically.

---

## Feature 2 — Native Card Form (No Redirect)

### Problem
Card payment calls `window.location.href = data.url`, taking the user away from FlyWise to AbacatePay's hosted checkout.

### Solution
Replace the card section in `Checkout.tsx` with a real HTML form. Payment stays entirely within FlyWise.

### UI — `src/pages/Checkout.tsx`
The existing split layout (dark-blue left column with logo + features / light-grey right panel) is preserved. The right panel's card tab replaces the "Ir para pagamento seguro" button with:

- **Cardholder name** — text input
- **Card number** — numeric input, auto-formats as `XXXX XXXX XXXX XXXX`, shows brand icon (Visa / Master / Elo / Amex) via BIN detection
- **Expiry** — `MM/YY` input
- **CVV** — 3–4 digit input, masked
- **Installments** — select dropdown (1x sem juros up to 12x, amounts calculated client-side from `priceVal`)
- **Submit button** — "🔒 Pagar R$ XX,XX", shows spinner during processing

### Backend — `POST /api/checkout/tokenize`
New route in `routes/checkout.js`:
1. Receives `{ cardNumber, cardHolder, expiryMonth, expiryYear, cvv }`
2. Calls AbacatePay `POST /v1/card/token/create` (or equivalent)
3. Returns `{ token }` to the front

### Front → tokenize → charge flow
1. User fills form and clicks pay
2. Front calls `POST /api/checkout/tokenize` → gets `token`
3. Front calls `POST /api/checkout` with `paymentMethod: 'cartao_tokenizado'` and `cardToken: token`
4. Backend creates AbacatePay billing using the token
5. Front polls `GET /api/checkout/status/:id` every 3 s (same as PIX)
6. On `PAID`: activate plan, confetti, redirect to `/onboarding`

### Fallback
If AbacatePay does not expose a card tokenization endpoint, replace step 2–4 above with an `<iframe src={billingUrl} />` embedded in the right panel (user stays on FlyWise URL; no full-page redirect). Decide during implementation once the AbacatePay docs are confirmed.

### Error states
- Tokenization failure → inline error below form, card fields remain editable
- Billing creation failure → inline error, retry button
- Poll timeout (> 10 min) → show "Pagamento não confirmado — verifique seu extrato ou tente novamente"

---

## Feature 3 — Cancellation Modal (Two Steps)

### Problem
The "Cancelar plano" button in Configurações does `setPlanoAtivo(null)` locally only — no backend call, no confirmation, no reason capture.

### UI — `CancelPlanModal` component

**Step 1 — Reason**
- Title: "Sentiremos sua falta 😢"
- Subtitle: "O que está te fazendo cancelar?"
- Radio list:
  - Preço muito alto
  - Não uso o suficiente
  - Prefiro outra ferramenta
  - Falta de funcionalidades
  - Outro motivo (reveals free-text textarea)
- CTA: "Próximo →"

**Step 2 — Retention or Confirmation (dynamic by reason)**

*If reason = "Preço muito alto" AND current plan is Pro or Elite:*
- Show downgrade offer to the next cheaper plan (Elite → Pro, Pro → Essencial)
- "Fazer downgrade para [plano] (R$ XX/mês)" button → navigates to `/planos`
- "Cancelar mesmo assim" link → proceeds to confirm

*If reason = "Preço muito alto" AND current plan is Essencial (no cheaper option):*
- Skip retention offer, go directly to Step 2 confirmation screen

*All other reasons:*
- Title: "Tem certeza?"
- Shows expiry date: "Seu acesso continua até DD/MM/AAAA"
- Two buttons: "Manter plano" (closes modal) | "Confirmar cancelamento" (red)

**On confirm:**
1. Calls `POST /api/user/cancel-plan` with `{ reason, reasonDetail? }`
2. Backend clears `plan`, `plan_expires_at`, `plan_billing` in `user_profiles`
3. Backend inserts row into `plan_cancellations(user_id, plan, reason, reason_detail, cancelled_at)`
4. Front updates local state → modal closes → plan card in Configurações switches to "Sem plano"

### Backend — `POST /api/user/cancel-plan`
New route (requires `requireUserJWT`):
- Reads `userId` from JWT
- Upserts `user_profiles`: `{ plan: null, plan_expires_at: null, plan_billing: null }`
- Inserts into `plan_cancellations`
- Returns `{ ok: true }`

### Database — `plan_cancellations` table (new migration)
```sql
CREATE TABLE plan_cancellations (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan        TEXT,
  reason      TEXT NOT NULL,
  reason_detail TEXT,
  cancelled_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE plan_cancellations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_only" ON plan_cancellations FOR ALL USING (FALSE);
```

---

## Files Changed

| File | Change |
|---|---|
| `routes/checkout.js` | Change `frequency`, add `/tokenize` route, add `/cancel-plan` route |
| `src/pages/Checkout.tsx` | Replace card section with native form + tokenize + poll flow |
| `src/pages/Configuracoes.tsx` | Wire "Cancelar plano" to open `CancelPlanModal` |
| `src/components/CancelPlanModal.tsx` | New component (2-step modal) |
| `supabase/migrations/031_plan_cancellations.sql` | New table |

---

## Out of Scope
- Proration / partial refunds on cancellation
- Pause subscription option
- Email notification on cancellation (can be added later)
- Admin view of cancellation reasons (data is in `plan_cancellations` table, accessible via SQL)
