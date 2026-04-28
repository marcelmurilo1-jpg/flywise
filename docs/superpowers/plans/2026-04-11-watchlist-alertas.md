# Watchlist de Rotas + Alertas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to monitor specific routes and receive email alerts via Resend when cash price (Google Flights scraper) or miles price (Seats.aero) drops below their defined threshold.

**Architecture:** Supabase table `watchlist_items` stores items per user with plan-enforced slot limits. A GitHub Actions cron triggers `POST /api/watchlist/check` daily at 7h UTC; the Railway server iterates active items, runs the existing `doScrape()` (cash) or `fetchSeatsAeroAPI()` (miles), sends email via Resend on threshold breach with 7-day cooldown. Frontend has a `WatchlistModal` triggered from Resultados cards, and a management section in Configurações.

**Tech Stack:** React + TypeScript, Express (server.js), Supabase (Postgres + RLS), Resend (email), GitHub Actions (cron), existing `doScrape()` + `fetchSeatsAeroAPI()` in server.js.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `supabase/migrations/022_watchlist.sql` | Create | Table + RLS policy |
| `src/lib/planLimits.ts` | Modify | Add `watchlistSlots` to PlanConfig |
| `server.js` | Modify | `requireUserJWT` middleware + 4 CRUD endpoints + check endpoint + `sendWatchlistEmail()` |
| `.github/workflows/watchlist-check.yml` | Create | Daily cron trigger |
| `src/components/WatchlistModal.tsx` | Create | Modal for adding a watchlist item |
| `src/pages/Resultados.tsx` | Modify | "🔔 Monitorar" button on cash + miles cards |
| `src/pages/Configuracoes.tsx` | Modify | Watchlist management section |

---

## Task 1: Supabase Migration + Plan Limits

**Files:**
- Create: `supabase/migrations/022_watchlist.sql`
- Modify: `src/lib/planLimits.ts`

- [ ] **Step 1: Create migration file**

```sql
-- supabase/migrations/022_watchlist.sql

create table if not exists watchlist_items (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  type             text not null check (type in ('cash', 'miles')),
  origin           text not null,
  destination      text not null,

  -- cash fields
  threshold_brl    int,
  airline          text,          -- null = any airline
  travel_date      date,

  -- miles fields
  threshold_miles  int,
  program          text,          -- e.g. "Smiles"
  cabin            text check (cabin in ('economy', 'business')),

  -- notification
  channel          text not null default 'email' check (channel in ('email', 'whatsapp', 'both')),

  -- control
  last_checked_at  timestamptz,
  last_notified_at timestamptz,
  active           boolean not null default true,
  created_at       timestamptz not null default now()
);

alter table watchlist_items enable row level security;

create policy "users own watchlist" on watchlist_items
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index watchlist_items_user_id_idx on watchlist_items(user_id);
create index watchlist_items_active_idx on watchlist_items(active) where active = true;
```

- [ ] **Step 2: Add `watchlistSlots` to planLimits.ts**

Read `src/lib/planLimits.ts` first, then add `watchlistSlots: number` to `PlanConfig` and update all plan entries:

```typescript
// In PlanConfig interface, add:
watchlistSlots: number

// In PLAN_LIMITS, update each plan:
admin:     { ..., watchlistSlots: 999 }
free:      { ..., watchlistSlots: 0 }
essencial: { ..., watchlistSlots: 3 }
pro:       { ..., watchlistSlots: 10 }
elite:     { ..., watchlistSlots: 999 }
```

Also add this helper function at the bottom of `planLimits.ts`:
```typescript
export function getWatchlistLimit(plan: Plan): number {
    return PLAN_LIMITS[plan].watchlistSlots
}
```

- [ ] **Step 3: Commit**

```bash
cd "/Users/muriloroizpovoa/Desktop/Fly Wise" && git add supabase/migrations/022_watchlist.sql src/lib/planLimits.ts && git commit -m "feat(watchlist): migration + plan slots"
```

---

## Task 2: Backend — `requireUserJWT` + CRUD Endpoints

**Files:**
- Modify: `server.js`

Context: `server.js` already has `requireAdminJWT` (line ~2646) that reads `Authorization: Bearer <token>` and calls `supabase.auth.getUser(token)`. We follow the same pattern but without the admin check, and attach `req.userId`.

The plan limits on the backend use `user_profiles.plan` from Supabase (same table used by `usePlan` hook). Free=0, Essencial=3, Pro=10, Elite/Admin=999.

- [ ] **Step 1: Add `requireUserJWT` middleware and install Resend**

First install Resend:
```bash
cd "/Users/muriloroizpovoa/Desktop/Fly Wise" && npm install resend
```

Then read `server.js` around line 2644 (near `requireAdminJWT`) to find the right insertion point. Add after `requireAdminJWT`:

```javascript
// ─── User JWT middleware (non-admin endpoints) ────────────────────────────────
async function requireUserJWT(req, res, next) {
    const authHeader = req.headers['authorization'] ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Token não fornecido' });
    if (!supabase) return res.status(503).json({ error: 'Supabase indisponível' });
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return res.status(401).json({ error: 'Token inválido' });
    req.userId = user.id;
    next();
}
```

Also add Resend import at the top of server.js (with other imports):
```javascript
import { Resend } from 'resend';
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const RESEND_FROM = process.env.RESEND_FROM ?? 'FlyWise <alertas@flywise.app>';
```

- [ ] **Step 2: Add watchlist slot limit helper**

Add this function after the Resend setup (or near other utility functions in server.js):

```javascript
// Returns how many watchlist slots the user's plan allows
const WATCHLIST_PLAN_LIMITS = { free: 0, essencial: 3, pro: 10, elite: 999, admin: 999 };
async function getWatchlistLimit(userId) {
    if (!supabase) return 0;
    const { data } = await supabase.from('user_profiles').select('plan').eq('id', userId).single();
    const plan = (data?.plan ?? 'free').toLowerCase();
    return WATCHLIST_PLAN_LIMITS[plan] ?? 0;
}
```

- [ ] **Step 3: Add GET /api/watchlist**

Find the end of the `POST /api/discover-routes` endpoint (Task 4 from previous feature, around line 555) and add after it:

```javascript
// ─── Watchlist CRUD ───────────────────────────────────────────────────────────

// GET /api/watchlist — list user's active watchlist items
app.get('/api/watchlist', requireUserJWT, async (req, res) => {
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
```

- [ ] **Step 4: Add POST /api/watchlist**

```javascript
// POST /api/watchlist — create a new watchlist item
app.post('/api/watchlist', requireUserJWT, async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase indisponível' });

    const limit = await getWatchlistLimit(req.userId);
    if (limit === 0) return res.status(403).json({ error: 'Seu plano não inclui watchlist. Faça upgrade.' });

    const { data: existing } = await supabase
        .from('watchlist_items')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', req.userId)
        .eq('active', true);
    const used = existing?.length ?? 0; // workaround: head:true count
    // Use count query instead
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

    if (!type || !origin || !destination) {
        return res.status(400).json({ error: 'type, origin e destination são obrigatórios' });
    }
    if (type === 'cash' && !threshold_brl) {
        return res.status(400).json({ error: 'threshold_brl obrigatório para type=cash' });
    }
    if (type === 'miles' && !threshold_miles) {
        return res.status(400).json({ error: 'threshold_miles obrigatório para type=miles' });
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
```

- [ ] **Step 5: Add PATCH /api/watchlist/:id and DELETE /api/watchlist/:id**

```javascript
// PATCH /api/watchlist/:id — update channel or threshold
app.patch('/api/watchlist/:id', requireUserJWT, async (req, res) => {
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
app.delete('/api/watchlist/:id', requireUserJWT, async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase indisponível' });
    const { error } = await supabase
        .from('watchlist_items')
        .update({ active: false })
        .eq('id', req.params.id)
        .eq('user_id', req.userId);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
});
```

- [ ] **Step 6: Commit**

```bash
cd "/Users/muriloroizpovoa/Desktop/Fly Wise" && git add server.js package.json package-lock.json && git commit -m "feat(watchlist): add requireUserJWT + CRUD endpoints + Resend import"
```

---

## Task 3: Backend — `sendWatchlistEmail` + Check Endpoint

**Files:**
- Modify: `server.js`

Context: `doScrape(origin, destination, date, returnDate)` is an existing function in server.js that returns `{ outbound: [...], inbound: [...] }` where each item has `preco_brl` and `companhia`. `fetchSeatsAeroAPI(origin, destination, date)` returns raw Seats.aero items; each has `source`, `economy` (miles), `business` (miles). `pLimit` is already imported at the top.

Cooldown: only send email if `last_notified_at` is null or older than 7 days.

- [ ] **Step 1: Add `sendWatchlistEmail` function**

Add this function in server.js after the CRUD endpoints:

```javascript
// ─── Watchlist email sender ───────────────────────────────────────────────────
async function sendWatchlistEmail({ toEmail, toName, item, triggeredValue }) {
    if (!resend) { console.warn('[Watchlist] Resend não configurado.'); return; }

    const isCash = item.type === 'cash';
    const subject = isCash
        ? `✈️ Alerta FlyWise — Preço caiu! ${item.origin}→${item.destination} R$ ${triggeredValue.toLocaleString('pt-BR')}`
        : `✈️ Alerta FlyWise — Preço em milhas Caiu! ${item.origin}→${item.destination} ${item.program} ${triggeredValue.toLocaleString('pt-BR')} milhas`;

    const appUrl = process.env.APP_URL ?? 'https://flywise.app';
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
  <div class="cta"><a href="${ctaUrl}" class="btn">${ctaText}</a></div>
  <div class="ftr">
    Você receberá outro aviso em 7 dias se o preço continuar baixo.<br>
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
```

- [ ] **Step 2: Add `POST /api/watchlist/check` endpoint**

Add after `sendWatchlistEmail`:

```javascript
// POST /api/watchlist/check — triggered daily by GitHub Actions
app.post('/api/watchlist/check', requireSyncSecret, async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Supabase indisponível' });

    const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
    const now = new Date();

    // Load all active items
    const { data: items, error: loadErr } = await supabase
        .from('watchlist_items')
        .select('*')
        .eq('active', true);

    if (loadErr) return res.status(500).json({ error: loadErr.message });
    if (!items || items.length === 0) return res.json({ checked: 0, triggered: 0 });

    // Load user emails in bulk via admin auth API
    const userIds = [...new Set(items.map(i => i.user_id))];
    let emailMap = {};
    let nameMap = {};
    try {
        // service_role key required for this
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
                // Use travel_date or default to next 15th
                const date = item.travel_date ?? (() => {
                    const d = new Date();
                    d.setMonth(d.getMonth() + 1);
                    d.setDate(15);
                    return d.toISOString().slice(0, 10);
                })();
                const { outbound } = await doScrape(item.origin, item.destination, date, null);
                const candidates = (outbound ?? []).filter(f =>
                    f.preco_brl > 0 && (!item.airline || f.companhia === item.airline)
                );
                if (candidates.length === 0) return;
                const best = Math.min(...candidates.map(f => f.preco_brl));
                if (best < item.threshold_brl) triggeredValue = best;

            } else {
                // miles
                const date = item.travel_date ?? (() => {
                    const d = new Date();
                    d.setMonth(d.getMonth() + 1);
                    d.setDate(15);
                    return d.toISOString().slice(0, 10);
                })();
                const raw = await fetchSeatsAeroAPI(item.origin, item.destination, date);
                const cabin = item.cabin === 'business' ? 'business' : 'economy';
                const candidates = raw.filter(r => {
                    const src = (r.Source ?? r.source ?? '').toLowerCase();
                    const prog = (item.program ?? '').toLowerCase();
                    return (!item.program || src.includes(prog) || prog.includes(src)) && r[cabin] != null;
                });
                if (candidates.length === 0) return;
                const best = Math.min(...candidates.map(r => r[cabin]));
                if (best < item.threshold_miles) triggeredValue = best;
            }

            // Update last_checked_at regardless
            await supabase.from('watchlist_items')
                .update({ last_checked_at: now.toISOString() })
                .eq('id', item.id);

            if (triggeredValue === null) return;

            // Check cooldown
            const lastNotified = item.last_notified_at ? new Date(item.last_notified_at) : null;
            if (lastNotified && (now - lastNotified) < COOLDOWN_MS) {
                console.log(`[Watchlist] Cooldown ativo para item ${item.id}`);
                return;
            }

            // Send email
            const toEmail = emailMap[item.user_id];
            if (toEmail) {
                await sendWatchlistEmail({
                    toEmail,
                    toName: nameMap[item.user_id],
                    item,
                    triggeredValue,
                });
                await supabase.from('watchlist_items')
                    .update({ last_notified_at: now.toISOString() })
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
```

- [ ] **Step 3: Commit**

```bash
cd "/Users/muriloroizpovoa/Desktop/Fly Wise" && git add server.js && git commit -m "feat(watchlist): add sendWatchlistEmail + daily check endpoint"
```

---

## Task 4: GitHub Actions Workflow

**Files:**
- Create: `.github/workflows/watchlist-check.yml`

- [ ] **Step 1: Create workflow file**

```yaml
name: Watchlist Check — FlyWise

on:
  schedule:
    - cron: '0 7 * * *'   # Todo dia às 7h UTC (4h BRT)
  workflow_dispatch:

jobs:
  check:
    name: Check watchlist price alerts
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - name: Trigger watchlist check on Railway
        env:
          RAILWAY_API_URL: ${{ secrets.RAILWAY_API_URL }}
          SYNC_SECRET: ${{ secrets.SYNC_SECRET }}
        run: |
          echo "Disparando verificação de watchlist..."
          RESPONSE=$(curl -s -o /tmp/response.json -w "%{http_code}" \
            -X POST "${RAILWAY_API_URL}/api/watchlist/check" \
            -H "x-sync-secret: ${SYNC_SECRET}" \
            -H "Content-Type: application/json" \
            --max-time 120)

          echo "HTTP Status: $RESPONSE"
          echo "Response:"
          cat /tmp/response.json

          if [ "$RESPONSE" != "200" ]; then
            echo "Erro: backend retornou status $RESPONSE"
            exit 1
          fi
```

- [ ] **Step 2: Commit**

```bash
cd "/Users/muriloroizpovoa/Desktop/Fly Wise" && git add .github/workflows/watchlist-check.yml && git commit -m "feat(watchlist): add daily GH Actions cron trigger"
```

---

## Task 5: `WatchlistModal.tsx` Component

**Files:**
- Create: `src/components/WatchlistModal.tsx`

Context: The app uses React + TypeScript with inline styles matching the design tokens from `src/index.css`. Auth token is obtained via `supabase.auth.getSession()`. The API base URL is `import.meta.env.VITE_API_BASE_URL ?? ''`. The `usePlan` hook returns `{ plan }`.

- [ ] **Step 1: Create the component**

```tsx
// src/components/WatchlistModal.tsx
import { useState, useEffect } from 'react'
import { X, Bell, Lock } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { usePlan } from '@/hooks/usePlan'
import { useNavigate } from 'react-router-dom'

export interface WatchlistModalProps {
    open: boolean
    onClose: () => void
    type: 'cash' | 'miles'
    origin: string        // IATA e.g. "GRU"
    destination: string   // IATA e.g. "LIS"
    // cash
    currentPriceBrl?: number
    airline?: string
    travelDate?: string
    // miles
    currentMiles?: number
    program?: string
    cabin?: 'economy' | 'business'
}

export function WatchlistModal({
    open, onClose, type,
    origin, destination,
    currentPriceBrl, airline, travelDate,
    currentMiles, program, cabin,
}: WatchlistModalProps) {
    const { plan } = usePlan()
    const navigate = useNavigate()
    const apiBase = import.meta.env.VITE_API_BASE_URL ?? ''

    const [thresholdBrl, setThresholdBrl] = useState(currentPriceBrl ?? 0)
    const [thresholdMiles, setThresholdMiles] = useState(currentMiles ?? 0)
    const [selectedAirline, setSelectedAirline] = useState<string | null>(airline ?? null)
    const [slotsUsed, setSlotsUsed] = useState(0)
    const [slotsLimit, setSlotsLimit] = useState(0)
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)
    const [error, setError] = useState('')

    const isFree = plan === 'free'

    useEffect(() => {
        if (!open) return
        setSaved(false)
        setError('')
        setThresholdBrl(currentPriceBrl ?? 0)
        setThresholdMiles(currentMiles ?? 0)
        setSelectedAirline(airline ?? null)
        // Fetch current usage
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session) return
            fetch(`${apiBase}/api/watchlist`, {
                headers: { Authorization: `Bearer ${session.access_token}` },
            })
                .then(r => r.json())
                .then(d => { setSlotsUsed(d.used ?? 0); setSlotsLimit(d.limit ?? 0) })
                .catch(() => {})
        })
    }, [open])

    if (!open) return null

    async function save() {
        setSaving(true)
        setError('')
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) throw new Error('Não autenticado')

            const body: Record<string, unknown> = {
                type,
                origin,
                destination,
                channel: 'email',
            }
            if (type === 'cash') {
                body.threshold_brl = thresholdBrl
                body.airline = selectedAirline ?? null
                body.travel_date = travelDate ?? null
            } else {
                body.threshold_miles = thresholdMiles
                body.program = program ?? null
                body.cabin = cabin ?? 'economy'
            }

            const res = await fetch(`${apiBase}/api/watchlist`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify(body),
            })
            if (!res.ok) {
                const d = await res.json()
                throw new Error(d.error ?? `Erro ${res.status}`)
            }
            setSaved(true)
            setTimeout(onClose, 1500)
        } catch (e: unknown) {
            setError((e as Error).message)
        } finally {
            setSaving(false)
        }
    }

    const slotsLeft = slotsLimit - slotsUsed

    return (
        <>
            {/* Backdrop */}
            <div
                onClick={onClose}
                style={{ position: 'fixed', inset: 0, background: 'rgba(14,42,85,0.45)', zIndex: 999, backdropFilter: 'blur(2px)' }}
            />
            {/* Modal */}
            <div style={{
                position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
                zIndex: 1000, width: '100%', maxWidth: 380, borderRadius: 16,
                overflow: 'hidden', boxShadow: '0 20px 80px rgba(14,42,85,0.20)',
            }}>
                {/* Header */}
                <div style={{ background: 'linear-gradient(135deg,#0E2A55,#2A60C2)', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Bell size={18} color="#fff" />
                        <span style={{ fontWeight: 800, fontSize: 14, color: '#fff' }}>
                            {type === 'cash' ? 'Monitorar preço' : 'Monitorar milhas'}
                        </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {slotsLimit > 0 && (
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: 'rgba(255,255,255,0.18)', borderRadius: 20, padding: '3px 9px' }}>
                                {slotsLeft} slot{slotsLeft !== 1 ? 's' : ''} restante{slotsLeft !== 1 ? 's' : ''}
                            </span>
                        )}
                        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', display: 'flex', padding: 0 }}>
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div style={{ background: '#fff', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {isFree ? (
                        /* Free plan teaser */
                        <div style={{ textAlign: 'center', padding: '16px 0' }}>
                            <Lock size={28} style={{ color: '#C0CFEA', margin: '0 auto 10px', display: 'block' }} />
                            <p style={{ fontWeight: 700, color: '#0E2A55', fontSize: 14, marginBottom: 6 }}>Watchlist disponível a partir do plano Essencial</p>
                            <p style={{ fontSize: 13, color: '#6B7A99', marginBottom: 16 }}>Monitore até 3 rotas e receba alertas por email quando o preço cair.</p>
                            <button
                                onClick={() => { onClose(); navigate('/planos') }}
                                style={{ background: 'linear-gradient(135deg,#2A60C2,#1A4A9C)', color: '#fff', border: 'none', borderRadius: 10, padding: '11px 24px', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
                            >
                                Ver planos →
                            </button>
                        </div>
                    ) : saved ? (
                        <div style={{ textAlign: 'center', padding: '20px 0' }}>
                            <div style={{ fontSize: 32, marginBottom: 10 }}>✅</div>
                            <p style={{ fontWeight: 800, color: '#0E2A55', fontSize: 15 }}>Alerta salvo!</p>
                            <p style={{ fontSize: 13, color: '#6B7A99', marginTop: 4 }}>Vamos te avisar por email quando o preço cair.</p>
                        </div>
                    ) : (
                        <>
                            {/* Route info */}
                            <div>
                                <div style={{ fontSize: 14, fontWeight: 800, color: '#0E2A55' }}>{origin} → {destination}</div>
                                <div style={{ fontSize: 12, color: '#6B7A99', fontWeight: 600, marginTop: 2 }}>
                                    {type === 'cash'
                                        ? `${airline ?? 'Qualquer companhia'}${travelDate ? ` · ${travelDate}` : ''}`
                                        : `${program ?? ''} · ${cabin === 'business' ? 'Business' : 'Economy'}`
                                    }
                                </div>
                            </div>

                            {/* Threshold */}
                            <div>
                                <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7A99', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                                    Avisar quando baixar de
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    {type === 'cash' && <span style={{ fontWeight: 800, color: '#0E2A55', fontSize: 15 }}>R$</span>}
                                    <input
                                        type="number"
                                        value={type === 'cash' ? thresholdBrl : thresholdMiles}
                                        onChange={e => {
                                            const v = parseInt(e.target.value) || 0
                                            type === 'cash' ? setThresholdBrl(v) : setThresholdMiles(v)
                                        }}
                                        style={{ width: 120, padding: '9px 12px', border: '1.5px solid #E2EAF5', borderRadius: 10, fontSize: 16, fontWeight: 800, color: '#0E2A55', fontFamily: 'inherit', background: '#F7F9FC' }}
                                    />
                                    {type === 'miles' && <span style={{ fontSize: 13, color: '#6B7A99', fontWeight: 600 }}>milhas</span>}
                                    <span style={{ fontSize: 11, color: '#A0AECB', fontWeight: 600 }}>
                                        atual: {type === 'cash' ? `R$ ${(currentPriceBrl ?? 0).toLocaleString('pt-BR')}` : `${(currentMiles ?? 0).toLocaleString('pt-BR')} mi`}
                                    </span>
                                </div>
                            </div>

                            {/* Airline selector (cash only) */}
                            {type === 'cash' && airline && (
                                <div>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7A99', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Companhia</div>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        {[airline, null].map(opt => (
                                            <button
                                                key={opt ?? 'any'}
                                                onClick={() => setSelectedAirline(opt)}
                                                style={{
                                                    padding: '5px 13px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                                                    border: 'none', cursor: 'pointer',
                                                    background: selectedAirline === opt ? '#0E2A55' : '#EEF2F8',
                                                    color: selectedAirline === opt ? '#fff' : '#6B7A99',
                                                }}
                                            >
                                                {opt ?? 'Qualquer'}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Channel */}
                            <div>
                                <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7A99', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Notificar por</div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <div style={{ flex: 1, padding: '9px 8px', borderRadius: 10, border: '1.5px solid #2A60C2', background: '#EEF6FF', color: '#2A60C2', fontSize: 12, fontWeight: 700, textAlign: 'center' }}>✉️ Email</div>
                                    <div style={{ flex: 1, padding: '9px 8px', borderRadius: 10, border: '1.5px solid #E2EAF5', background: '#F7F9FC', color: '#C0CFEA', fontSize: 11, fontWeight: 700, textAlign: 'center' }}>💬 WhatsApp<br /><span style={{ fontSize: 10 }}>em breve</span></div>
                                </div>
                            </div>

                            {/* Error */}
                            {error && <div style={{ fontSize: 13, color: '#EF4444', fontWeight: 600 }}>{error}</div>}

                            {/* Save button */}
                            <button
                                onClick={save}
                                disabled={saving || slotsLeft <= 0}
                                style={{
                                    width: '100%', padding: '13px', background: slotsLeft <= 0 ? '#C0CFEA' : 'linear-gradient(135deg,#2A60C2,#1A4A9C)',
                                    color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 800,
                                    cursor: saving || slotsLeft <= 0 ? 'not-allowed' : 'pointer',
                                    boxShadow: slotsLeft <= 0 ? 'none' : '0 4px 20px rgba(42,96,194,0.30)',
                                    fontFamily: 'inherit',
                                }}
                            >
                                {saving ? 'Salvando...' : slotsLeft <= 0 ? 'Limite atingido' : 'Salvar alerta'}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </>
    )
}
```

- [ ] **Step 2: Commit**

```bash
cd "/Users/muriloroizpovoa/Desktop/Fly Wise" && git add src/components/WatchlistModal.tsx && git commit -m "feat(watchlist): add WatchlistModal component"
```

---

## Task 6: Add "🔔 Monitorar" Buttons in Resultados.tsx

**Files:**
- Modify: `src/pages/Resultados.tsx`

Context: Resultados.tsx has two card types:
1. **Cash cards**: `ResultadoVoo` with `.preco_brl`, `.companhia`, `.detalhes?.partida` as date. Rendered around line 585+ inside a loop over `flights`.
2. **Miles cards**: `seatsFlights` entries (type `any`) with `.precoMilhas`, `.source`, `.companhia`, `.dataVoo`, `.cabineEncontrada`. Rendered around line 765+ inside the `(seatsPhase === 'ida' ? idaFlights : voltaFlights).map(...)` loop.

The `WatchlistModal` state should live in the `Resultados` component (one modal shared, data passed in).

- [ ] **Step 1: Add import and modal state**

At the top of `Resultados.tsx`, add the import:
```typescript
import { WatchlistModal, type WatchlistModalProps } from '@/components/WatchlistModal'
```

Inside the `Resultados` component, add state alongside the other state declarations:
```typescript
const [watchlistModal, setWatchlistModal] = useState<(Omit<WatchlistModalProps, 'open' | 'onClose'>) | null>(null)
```

- [ ] **Step 2: Add modal render**

Find where `<StrategyPanel` is rendered (near end of the JSX, around line 907) and add the WatchlistModal before or after it:
```tsx
<WatchlistModal
    open={watchlistModal !== null}
    onClose={() => setWatchlistModal(null)}
    {...(watchlistModal ?? { type: 'cash', origin: '', destination: '' })}
/>
```

- [ ] **Step 3: Add button to cash flight cards**

Find where cash flight cards render their action button (they have a "Selecionar" or similar button). Read the file to find the exact location — look for `preco_brl` and the flight card container for cash results. Add the Monitorar button next to the existing card action:

```tsx
<button
    onClick={() => setWatchlistModal({
        type: 'cash',
        origin: originIata || origem || '',
        destination: destIata || destino || '',
        currentPriceBrl: flight.preco_brl ?? 0,
        airline: flight.companhia ?? undefined,
        travelDate: dateGo || undefined,
    })}
    style={{
        background: '#FEF3C7', color: '#D97706', border: 'none', borderRadius: 8,
        padding: '7px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
    }}
>
    🔔
</button>
```

Note: `flight` is the loop variable for each cash card. `originIata`, `destIata`, `dateGo` are state variables in the component. Read the file to confirm the exact variable names used.

- [ ] **Step 4: Add button to miles flight cards**

In the miles cards loop (around line 765), find where the "Selecionar →" button is rendered and add the Monitorar button next to it:

```tsx
<button
    onClick={() => setWatchlistModal({
        type: 'miles',
        origin: originIata || '',
        destination: destIata || '',
        currentMiles: typeof sf.precoMilhas === 'number' ? sf.precoMilhas : parseInt(sf.precoMilhas ?? '0') || 0,
        program: program?.name ?? sf.source ?? undefined,
        cabin: (sf.cabineEncontrada ?? 'Economy').toLowerCase() === 'business' ? 'business' : 'economy',
        travelDate: sf.dataVoo ?? undefined,
    })}
    style={{
        background: '#EDE9FE', color: '#7C3AED', border: 'none', borderRadius: 8,
        padding: '7px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
    }}
>
    🔔
</button>
```

Note: `sf` is the loop variable, `program` is defined earlier in the same loop as `SOURCE_PROGRAM[sf.source?.toLowerCase() ?? '']`. `originIata`, `destIata` are state variables.

- [ ] **Step 5: Run TypeScript check**

```bash
cd "/Users/muriloroizpovoa/Desktop/Fly Wise" && npx tsc --noEmit 2>&1 | head -30
```

Fix any errors before committing.

- [ ] **Step 6: Commit**

```bash
cd "/Users/muriloroizpovoa/Desktop/Fly Wise" && git add src/pages/Resultados.tsx && git commit -m "feat(watchlist): add Monitorar buttons to cash and miles cards in Resultados"
```

---

## Task 7: Watchlist Section in Configuracoes.tsx

**Files:**
- Modify: `src/pages/Configuracoes.tsx`

Context: `Configuracoes.tsx` has a `SectionId` type and a `SECTIONS` array with `{ id: SectionId; label: string; Icon: React.ElementType }`. Sections render conditionally by `activeSection`. The viagem section was recently modified (Task 2 of the previous feature). `supabase` and `useAuth` are already imported.

- [ ] **Step 1: Read the file to understand the SECTIONS array and section rendering pattern**

Read `src/pages/Configuracoes.tsx` around lines 17, 79, and 691 to understand the exact pattern before editing.

- [ ] **Step 2: Add watchlist to SectionId and SECTIONS**

Find `type SectionId = 'perfil' | 'seguranca' | 'viagem' | 'notificacoes' | 'plano' | 'conta'` and add `'watchlist'`:
```typescript
type SectionId = 'perfil' | 'seguranca' | 'viagem' | 'notificacoes' | 'watchlist' | 'plano' | 'conta'
```

In the `SECTIONS` array, add before `{ id: 'plano', ... }`:
```typescript
{ id: 'watchlist', label: 'Rotas Monitoradas', Icon: Bell },
```

Add `Bell` to the lucide-react import if not already there.

- [ ] **Step 3: Add watchlist state to the component**

After the existing profile state, add:
```typescript
const [watchlistItems, setWatchlistItems] = useState<WatchlistItem[]>([])
const [watchlistLimit, setWatchlistLimit] = useState(0)
const [watchlistLoading, setWatchlistLoading] = useState(false)
```

Add the `WatchlistItem` type at the top of the file (after existing type definitions):
```typescript
interface WatchlistItem {
    id: string
    type: 'cash' | 'miles'
    origin: string
    destination: string
    threshold_brl?: number
    threshold_miles?: number
    airline?: string
    program?: string
    cabin?: string
    channel: string
    created_at: string
}
```

- [ ] **Step 4: Add `loadWatchlist` function**

After the `upsertProfile` function, add:
```typescript
const apiBase = import.meta.env.VITE_API_BASE_URL ?? ''

const loadWatchlist = async () => {
    if (!user) return
    setWatchlistLoading(true)
    try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return
        const res = await fetch(`${apiBase}/api/watchlist`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
        })
        const d = await res.json()
        setWatchlistItems(d.items ?? [])
        setWatchlistLimit(d.limit ?? 0)
    } catch (e) {
        console.error('Erro ao carregar watchlist:', e)
    } finally {
        setWatchlistLoading(false)
    }
}
```

Trigger it when the watchlist section is opened — add to the `useEffect` that runs when sections change, or use a simple effect:
```typescript
useEffect(() => {
    if (activeSection === 'watchlist') loadWatchlist()
}, [activeSection])
```

- [ ] **Step 5: Add `deleteWatchlistItem` and `updateWatchlistChannel` functions**

```typescript
const deleteWatchlistItem = async (id: string) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    await fetch(`${apiBase}/api/watchlist/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
    })
    setWatchlistItems(prev => prev.filter(i => i.id !== id))
}

const updateWatchlistChannel = async (id: string, channel: string) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    await fetch(`${apiBase}/api/watchlist/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ channel }),
    })
    setWatchlistItems(prev => prev.map(i => i.id === id ? { ...i, channel } : i))
}
```

- [ ] **Step 6: Add watchlist section JSX**

Find where the `notificacoes` section ends and the `plano` section begins. Insert the watchlist section between them:

```tsx
{/* ── Rotas Monitoradas ─────────────────────────────────── */}
<SectionCard id="watchlist" title="Rotas Monitoradas" description="Gerencie seus alertas de preço" Icon={Bell}>
    {watchlistLoading ? (
        <div style={{ fontSize: 13, color: '#6B7A99', textAlign: 'center', padding: 16 }}>Carregando...</div>
    ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#0E2A55' }}>
                    {watchlistItems.length} de {watchlistLimit === 999 ? '∞' : watchlistLimit} usadas
                </span>
                {watchlistLimit < 999 && (
                    <button
                        onClick={() => navigate('/planos')}
                        style={{ fontSize: 12, color: '#2A60C2', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}
                    >
                        upgrade →
                    </button>
                )}
            </div>

            {watchlistItems.length === 0 && (
                <div style={{ fontSize: 13, color: '#A0AECB', textAlign: 'center', padding: '16px 0', fontWeight: 600 }}>
                    Nenhuma rota monitorada ainda.<br />Use o botão 🔔 nos resultados de busca.
                </div>
            )}

            {watchlistItems.map(item => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 0', borderBottom: '1px solid #E2EAF5' }}>
                    <div style={{ width: 34, height: 34, borderRadius: 10, background: item.type === 'cash' ? 'rgba(234,179,8,0.10)' : 'rgba(42,96,194,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                        {item.type === 'cash' ? '💰' : '✈️'}
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: '#0E2A55', marginBottom: 2 }}>
                            {item.origin} → {item.destination}
                            {item.type === 'cash' && item.airline ? ` · ${item.airline}` : ''}
                            {item.type === 'miles' && item.program ? ` · ${item.program}` : ''}
                        </div>
                        <div style={{ fontSize: 11, color: '#6B7A99', fontWeight: 600, marginBottom: 6 }}>
                            {item.type === 'cash'
                                ? `Cash · abaixo de R$ ${(item.threshold_brl ?? 0).toLocaleString('pt-BR')}`
                                : `Milhas · abaixo de ${(item.threshold_miles ?? 0).toLocaleString('pt-BR')} · ${item.cabin === 'business' ? 'Business' : 'Economy'}`
                            }
                        </div>
                        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: '#A0AECB', marginRight: 2 }}>VIA</span>
                            <button
                                style={{ padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700, border: '1.5px solid #2A60C2', background: '#EEF6FF', color: '#2A60C2', cursor: 'default' }}
                            >
                                ✉️ Email
                            </button>
                            <button
                                disabled
                                style={{ padding: '3px 9px', borderRadius: 20, fontSize: 10, fontWeight: 700, border: '1.5px solid #E2EAF5', background: '#F7F9FC', color: '#C0CFEA', cursor: 'not-allowed' }}
                            >
                                💬 WPP em breve
                            </button>
                        </div>
                    </div>
                    <button
                        onClick={() => deleteWatchlistItem(item.id)}
                        style={{ width: 30, height: 30, borderRadius: 8, background: '#FEF2F2', border: 'none', color: '#EF4444', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                    >
                        🗑
                    </button>
                </div>
            ))}

            {/* Empty slots */}
            {Array.from({ length: Math.max(0, Math.min(watchlistLimit === 999 ? 0 : watchlistLimit - watchlistItems.length, 3)) }).map((_, i) => (
                <div key={`empty-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', opacity: 0.5 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 10, border: '1.5px dashed #C0CFEA', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#C0CFEA', fontSize: 16 }}>+</div>
                    <span style={{ fontSize: 12, color: '#A0AECB', fontWeight: 600 }}>Slot disponível</span>
                </div>
            ))}
        </div>
    )}
</SectionCard>
```

Note: `navigate` needs to be imported — add `const navigate = useNavigate()` to the component if not already there (check the existing imports).

- [ ] **Step 7: Run TypeScript check**

```bash
cd "/Users/muriloroizpovoa/Desktop/Fly Wise" && npx tsc --noEmit 2>&1 | head -30
```

Fix any errors.

- [ ] **Step 8: Commit**

```bash
cd "/Users/muriloroizpovoa/Desktop/Fly Wise" && git add src/pages/Configuracoes.tsx && git commit -m "feat(watchlist): add Rotas Monitoradas section in Configuracoes"
```

---

## Self-Review

**Spec coverage:**

| Requirement | Task |
|-------------|------|
| `watchlist_items` table + RLS | Task 1 ✅ |
| Plan slots: Free=0, Essencial=3, Pro=10, Elite=∞ | Task 1 + 2 ✅ |
| `GET/POST/PATCH/DELETE /api/watchlist` | Task 2 ✅ |
| Resend email with correct template | Task 3 ✅ |
| "Preço em milhas Caiu!" subject line | Task 3 ✅ |
| 7-day cooldown between alerts | Task 3 ✅ |
| `pLimit(2)` for scraper concurrency | Task 3 ✅ |
| Daily GH Actions cron 7h UTC | Task 4 ✅ |
| WatchlistModal with FlyWise branding | Task 5 ✅ |
| Free plan teaser in modal | Task 5 ✅ |
| 🔔 button on cash cards (Resultados) | Task 6 ✅ |
| 🔔 button on miles cards (Resultados) | Task 6 ✅ |
| Watchlist section in Configurações | Task 7 ✅ |
| WhatsApp "em breve" disabled | Tasks 5, 7 ✅ |

**Placeholder scan:** No TBDs. Every step has complete code. ✅

**Type consistency:** `WatchlistItem` defined in Task 7 matches API response from Task 2. `WatchlistModalProps` defined in Task 5, consumed in Task 6. `getWatchlistLimit` in Task 1 (frontend) mirrors `WATCHLIST_PLAN_LIMITS` in Task 2 (backend). ✅
