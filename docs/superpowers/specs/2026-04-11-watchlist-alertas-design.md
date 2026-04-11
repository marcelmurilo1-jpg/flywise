# Design: Watchlist de Rotas + Alertas

**Data:** 2026-04-11  
**Status:** Aprovado pelo usuário  
**Escopo:** Feature 2 de 3 (Para onde posso voar? já implementado; Calendário de preços é spec separado)

---

## Objetivo

Permitir que o usuário monitore rotas específicas e receba alertas por email quando o preço em dinheiro (Google Flights) ou em milhas (Seats.aero) cair abaixo de um threshold definido por ele — sem precisar checar manualmente.

---

## Fluxo do usuário

1. Na página de resultados, o usuário vê um card de voo (cash ou milhas) e clica **"🔔 Monitorar"**
2. Um modal abre pré-preenchido com os dados da busca atual (rota, preço/milhas atual, programa/companhia)
3. O usuário ajusta o threshold (ex: "avise se cair de R$ 2.840" ou "avise se cair de 85.000 milhas")
4. Para cash: escolhe companhia específica ou qualquer
5. Escolhe canal de notificação (Email — WhatsApp "em breve")
6. Salva — o item aparece em **Configurações → Rotas monitoradas**
7. Diariamente às 7h UTC o sistema verifica todos os itens ativos e envia email se o threshold for atingido

---

## Acesso por plano

| Plano | Slots de watchlist |
|-------|-------------------|
| Free | 0 (vê botão como teaser → redireciona para /planos) |
| Essencial | 3 rotas |
| Pro | 10 rotas |
| Elite | Ilimitado |

---

## Modelo de dados

Nova tabela Supabase: `watchlist_items`

```sql
create table watchlist_items (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  type             text not null check (type in ('cash', 'miles')),
  origin           text not null,          -- IATA ex: "GRU"
  destination      text not null,          -- IATA ex: "LIS"

  -- Campos cash
  threshold_brl    int,                    -- ex: 2840
  airline          text,                   -- null = qualquer companhia
  travel_date      date,                   -- data de viagem para o scraper

  -- Campos milhas
  threshold_miles  int,                    -- ex: 85000
  program          text,                   -- ex: "Smiles"
  cabin            text check (cabin in ('economy', 'business')),

  -- Notificação
  channel          text not null default 'email' check (channel in ('email', 'whatsapp', 'both')),

  -- Controle
  last_checked_at  timestamptz,
  last_notified_at timestamptz,            -- null = nunca notificado; evita spam (cooldown 7 dias)
  active           boolean not null default true,
  created_at       timestamptz not null default now()
);

-- RLS: usuário só vê/edita seus próprios itens
alter table watchlist_items enable row level security;
create policy "users own watchlist" on watchlist_items
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

---

## Mudanças por camada

### 1. Supabase — migration

Arquivo: `supabase/migrations/022_watchlist.sql`

Cria a tabela `watchlist_items` com RLS conforme modelo acima.

---

### 2. Backend — novos endpoints (`server.js`)

#### `GET /api/watchlist`
Retorna os itens ativos do usuário autenticado (via JWT do Supabase).
```json
{ "items": [...], "limit": 3, "used": 2 }
```

#### `POST /api/watchlist`
Cria um novo item. Valida limite do plano antes de inserir.
```json
{
  "type": "cash",
  "origin": "GRU",
  "destination": "LIS",
  "threshold_brl": 2840,
  "airline": "LATAM",
  "travel_date": "2026-05-14",
  "channel": "email"
}
```
Retorna `201` com o item criado, ou `403` se limite atingido.

#### `PATCH /api/watchlist/:id`
Atualiza `channel`, `threshold_brl`, ou `threshold_miles`. Apenas campos editáveis.

#### `DELETE /api/watchlist/:id`
Remove o item (soft: `active = false`).

#### `POST /api/watchlist/check` (protegido por `SYNC_SECRET`)
Endpoint disparado pelo GitHub Actions. Itera todos os `watchlist_items` ativos:

```javascript
// Pseudocódigo do loop de verificação
const limit = pLimit(2) // máx 2 scrapes paralelos

for each item (batches de 20):
  if item.type === 'cash':
    results = await doScrape(item.origin, item.destination, item.travel_date)
    bestPrice = min(results filtered by airline).preco_brl
    triggered = bestPrice < item.threshold_brl

  if item.type === 'miles':
    date = item.travel_date ?? próximo dia 15 do mês seguinte
    results = await fetchSeatsAeroAPI(item.origin, item.destination, date)
    bestMiles = min(results filtered by program + cabin).miles
    triggered = bestMiles < item.threshold_miles

  if triggered AND (last_notified_at is null OR last_notified_at < 7 dias atrás):
    sendWatchlistEmail(item, bestPrice ?? bestMiles)
    update last_notified_at = now()

  update last_checked_at = now()
```

**Cooldown:** 7 dias entre notificações para o mesmo item (evita spam se o preço oscilar).  
**Itens sem `travel_date`** (milhas sem data específica): usa o próximo dia 15 do mês seguinte como data de amostragem.

---

### 3. Email — Resend

Função `sendWatchlistEmail(item, value)` no `server.js`, usando o cliente Resend já configurado.

**Template cash:**
```
Assunto: ✈️ Alerta FlyWise — GRU→LIS caiu para R$ 2.600

Oi [nome],

O preço que você estava monitorando caiu!

  GRU → LIS · LATAM · 14 mai
  💰 R$ 2.600  (você queria abaixo de R$ 2.840)

[Ver voo →]  https://flywise.app/resultados?orig=GRU&dest=LIS&date=2026-05-14

Você receberá outro aviso se o preço cair ainda mais em 7 dias.
Gerencie seus alertas em Configurações → Rotas monitoradas.
```

**Template milhas:**
```
Assunto: ✈️ Alerta FlyWise — Preço em milhas Caiu! GRU→LIS Smiles Business: 70.000 milhas

Oi [nome],

O preço em milhas que você monitorava caiu abaixo do seu limite!

  GRU → LIS · Smiles · Business
  ✈️ 70.000 milhas  (você queria abaixo de 85.000)

[Ver estratégia →]  https://flywise.app/resultados?orig=GRU&dest=LIS

Você receberá outro aviso em 7 dias se continuar disponível.
Gerencie seus alertas em Configurações → Rotas monitoradas.
```

---

### 4. Frontend — `WatchlistModal.tsx` (novo componente)

Componente modal com branding FlyWise (gradiente navy/blue no header, fonte Manrope).

**Props:**
```typescript
interface WatchlistModalProps {
  open: boolean
  onClose: () => void
  type: 'cash' | 'miles'
  origin: string
  destination: string
  // cash
  currentPriceBrl?: number
  airline?: string
  travelDate?: string
  // miles
  currentMiles?: number
  program?: string
  cabin?: 'economy' | 'business'
}
```

**Conteúdo:**
- Header com gradiente: "🔔 Monitorar preço" / "🔔 Monitorar milhas" + badge "N slots restantes"
- Rota + dados atuais (pré-preenchidos, somente leitura)
- Input de threshold (pré-preenchido com valor atual)
- Para cash: toggle "LATAM | Qualquer" para companhia
- Seleção de canal: Email (ativo) | WhatsApp (desabilitado "em breve")
- Botão "Salvar alerta" → `POST /api/watchlist`
- Se Free: mostra teaser em vez do form → botão "Ver planos"

---

### 5. Frontend — `Resultados.tsx` (modificar)

Adicionar botão "🔔 Monitorar" em dois lugares:

**Card de voo cash (Google Flights):**
```tsx
<button onClick={() => openWatchlistModal('cash', { origin, destination, priceBrl: card.preco_brl, airline: card.companhia, travelDate: card.data })}>
  🔔 Monitorar
</button>
```

**Card de milhas (Seats.aero):**
```tsx
<button onClick={() => openWatchlistModal('miles', { origin, destination, miles: card.economy ?? card.business, program: card.programName, cabin })}>
  🔔 Monitorar
</button>
```

---

### 6. Frontend — `Configuracoes.tsx` (modificar)

Nova seção `'watchlist'` no `SectionId` e no array `SECTIONS`:

```
[Perfil] [Segurança] [Preferências] [Notificações] [Watchlist] [Plano] [Conta]
```

**Conteúdo da seção:**
- Header: "Rotas monitoradas" + contador "2 de 3 usadas · upgrade →"
- Lista de itens com ícone (💰 cash / ✈️ milhas), nome da rota, threshold, canal
- Pills de canal editáveis inline (Email ativo, WhatsApp desabilitado "em breve")
- Botão lixeira → `DELETE /api/watchlist/:id`
- Slots vazios mostrados como "dashed placeholder"

---

### 7. GitHub Actions — `watchlist-check.yml`

```yaml
name: Watchlist Check

on:
  schedule:
    - cron: '0 7 * * *'   # todo dia às 7h UTC (4h BRT)
  workflow_dispatch:

jobs:
  check:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - name: Trigger watchlist check on Railway
        env:
          RAILWAY_API_URL: ${{ secrets.RAILWAY_API_URL }}
          SYNC_SECRET: ${{ secrets.SYNC_SECRET }}
        run: |
          RESPONSE=$(curl -s -o /tmp/response.json -w "%{http_code}" \
            -X POST "${RAILWAY_API_URL}/api/watchlist/check" \
            -H "x-sync-secret: ${SYNC_SECRET}" \
            -H "Content-Type: application/json" \
            --max-time 120)
          echo "HTTP: $RESPONSE"
          cat /tmp/response.json
          if [ "$RESPONSE" != "200" ]; then exit 1; fi
```

---

## Arquivos a criar/modificar

| Arquivo | Tipo |
|---------|------|
| `supabase/migrations/022_watchlist.sql` | Novo |
| `src/components/WatchlistModal.tsx` | Novo |
| `src/pages/Resultados.tsx` | Modificar — botão Monitorar nos cards |
| `src/pages/Configuracoes.tsx` | Modificar — seção Watchlist |
| `server.js` | Modificar — 4 endpoints + sendWatchlistEmail |
| `.github/workflows/watchlist-check.yml` | Novo |

---

## Fora do escopo deste spec

- WhatsApp (preparado na UI mas desabilitado — implementado em spec futuro)
- Histórico de alertas disparados
- Pausa de alerta sem deletar
- Calendário de preços flexível (spec separado)
