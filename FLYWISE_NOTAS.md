# FlyWise — Notas Críticas para IA

> Decisões não-óbvias, armadilhas e contexto que uma IA sem histórico do projeto entenderia errado.
> Manter este arquivo atualizado a cada mudança estrutural relevante.

---

## 1. Estrutura do Backend — Refatoração Recente

**O que a IA pode supor de errado:** Que `server.js` ainda é um monolito de 4.000+ linhas.

**Realidade atual (maio/2025):**
- `server.js` tem **92 linhas** — só inicialização, cron e `app.listen()`
- Toda a lógica de rotas está em `routes/`

```
routes/
├── seats.js          # /api/search-flights, /api/discover-routes
├── watchlist.js      # /api/watchlist (CRUD + sync)
├── amadeus.js        # /api/amadeus/flights (scraper Google Flights)
├── checkout.js       # /api/checkout + webhook AbacatePay
├── awardPrices.js    # /api/award-prices
├── transferPromos.js # /api/transfer-promotions
└── admin.js          # /api/admin/* (sync, stats, users, posts)
```

- Arquivo de backup do monolito: `server.old.js` (não usar como referência)
- A regra "não fragmentar server.js" em `CLAUDE_PROJECT_INSTRUCTIONS.md` está **desatualizada**

**Exports nomeados que server.js usa para crons/startup:**
```js
import transferPromosRouter, { refreshPromotionsCache } from './routes/transferPromos.js';
import adminRouter, { syncTransferData } from './routes/admin.js';
import { chromiumBinaryExists } from './scraper/browser.js';
```

---

## 2. Dois Scrapers Distintos no Mesmo Diretório `scraper/`

**O que a IA pode supor de errado:** Que `scraper/` é só um scraper.

**Realidade:**

| Arquivo | Linguagem | Propósito | Onde roda |
|---------|-----------|-----------|-----------|
| `scraper/browser.js` | Node.js | Playwright browser manager (Google Flights) | Dentro do processo Express |
| `scraper/googleFlights.js` | Node.js | Extração de preços do Google Flights | Dentro do processo Express |
| `scraper/airlineMaps.js` | Node.js | Mapas IATA → nome da cia/cidade | Importado pelos outros |
| `scraper/run.py` | Python | Scraper de promoções RSS (Smiles, etc.) | GitHub Actions (2x/dia) |
| `scraper/scrape_passageiro.py` | Python | Scraper site Passageiro de Primeira | GitHub Actions |
| `scraper/notify.py` | Python | Emails de alerta via Resend | Chamado por run.py |

O scraper Python acessa o Supabase diretamente via `DATABASE_URL` (PostgreSQL). Não usa o servidor Express.

O scraper JavaScript roda dentro do processo Express via Playwright/Chromium.

---

## 3. Playwright — Três Armadilhas Críticas

### 3.1 `PLAYWRIGHT_BROWSERS_PATH` antes do import

A variável de ambiente **deve** ser definida antes de qualquer `import 'playwright-extra'`. No `server.js`:

```js
// CORRETO: env var definida antes do dynamic import
if (!process.env.PLAYWRIGHT_BROWSERS_PATH) {
    if (fs.existsSync('/app/.playwright-browsers'))
        process.env.PLAYWRIGHT_BROWSERS_PATH = '/app/.playwright-browsers';
}
const { chromium } = await import('playwright-extra'); // dynamic import, ocorre depois
```

Os static imports no topo do arquivo (browser.js, routes/*.js) são hoisted mas **nenhum deles importa playwright-extra estaticamente**, então o env var está disponível quando o dynamic import acontece.

No Railway: `/app/.playwright-browsers` é baked na imagem Docker (Dockerfile + nixpacks.toml). Nunca usar `/tmp` — é apagado a cada restart, forçando reinstalação de 90s a cada boot.

### 3.2 `_browser` é privado a `browser.js`

`_browser` não pode ser acessado ou zerado diretamente fora de `browser.js`. Usar as funções exportadas:

```js
import { clearBrowserRef, getBrowserRef } from './scraper/browser.js';
clearBrowserRef(); // equivalente ao antigo: _browser = null
```

### 3.3 `IATA_TO_AIRLINE` dentro de `page.evaluate()`

`page.evaluate()` roda no contexto do browser, não do Node.js. Variáveis Node não estão disponíveis lá. A solução é passar como argumento:

```js
// ERRADO — _iataToAirline será undefined no browser
await page.evaluate(() => { const name = IATA_TO_AIRLINE['LA']; });

// CORRETO — passar como argumento
await page.evaluate(({ _iataToAirline }) => {
    const name = _iataToAirline['LA'];
}, { _iataToAirline: IATA_TO_AIRLINE });
```

---

## 4. Estado de Módulo (Singletons) — Não São Globais do servidor

Algumas variáveis de módulo compartilham estado entre requisições mas são **privadas ao módulo**:

| Variável | Módulo | Acesso externo |
|----------|--------|----------------|
| `_gfCache` | `scraper/googleFlights.js` | Exportado como `_gfCache` (para diagnóstico) |
| `_gfInflight` | `scraper/googleFlights.js` | Exportado como `_gfInflight` (deduplicação) |
| `promotionsCache` | `routes/transferPromos.js` | Via `getPromotionsCache()` |
| `promotionsCacheAt` | `routes/transferPromos.js` | Resetar via `resetPromotionsCacheAt()` |
| `_browser` | `scraper/browser.js` | Via `getBrowserRef()` / `clearBrowserRef()` |

Para forçar refresh das promoções no próximo request: `resetPromotionsCacheAt()` (zera o timestamp de expiração).

---

## 5. Dois Sistemas de IA Diferentes

**O que a IA pode supor de errado:** Que o projeto usa só uma IA.

| Feature | Modelo | Onde roda | Arquivo |
|---------|--------|-----------|---------|
| Estratégias de milhas | OpenAI GPT-4o-mini | Supabase Edge Function (Deno) | `supabase/functions/strategy/` |
| Busca com NLP | OpenAI GPT-4o-mini | Supabase Edge Function (Deno) | `supabase/functions/chat-busca/` |
| Roteiro day-by-day | OpenAI GPT-4o-mini | Supabase Edge Function (Deno) | `supabase/functions/itinerary/` |
| Sync promoções de transferência | **Claude (Anthropic)** | Node.js Express (Railway) | `routes/admin.js` → `analyzeTransferDataWithClaude()` |

As Edge Functions usam `OPENAI_API_KEY`. O sync de promoções usa `ANTHROPIC_API_KEY`. São completamente separados.

A IA (Claude) no backend recebe conteúdo scrapeado de RSS feeds e páginas de blogs de viagens, extrai promoções de transferência (programa, bônus %, validade, regras) e atualiza a tabela `transfer_promotions`.

---

## 6. Edge Functions — `--no-verify-jwt` Obrigatório

**Por quê:** O Supabase migrou para um novo formato de chave (`sb_publishable_...`). O gateway JWT automático quebra com esse formato. A solução é desabilitar a verificação automática e validar manualmente:

```ts
// Sempre deploy assim:
// supabase functions deploy <nome> --no-verify-jwt

// Dentro da função, validar manualmente:
const { data: { user } } = await supabase.auth.getUser(token)
```

Nunca usar `--no-verify-jwt` sem fazer a validação manual logo em seguida.

---

## 7. AbacatePay — Pagamento Assíncrono

O status de pagamento **não é síncrono**. O fluxo é:

1. `POST /api/checkout` → cria cobrança, retorna URL de pagamento
2. Usuário paga (PIX ou cartão)
3. AbacatePay dispara webhook para `POST /api/webhook/abacatepay` → ativa plano
4. Frontend faz polling em `GET /api/checkout/status/:id` para checar

Não existe confirmação imediata de pagamento no `POST /api/checkout`. Nunca assumir que o retorno do checkout já significa pagamento confirmado.

O webhook valida assinatura via header `x-webhook-secret` (comparado com `ABACATEPAY_WEBHOOK_SECRET` no env).

---

## 8. Seats.aero — 429 é Normal, Cache é Obrigatório

A API retorna 429 (rate limit) com frequência. O cache de 10 minutos na tabela `seatsaero_searches` **não é opcional** — sem ele o app fica inutilizável. Nunca remover ou encurtar o TTL sem entender o impacto.

A chave `SEATS_AERO_API_KEY` vai para o `server.js` via `lib/seatsAero.js`. Existe também `VITE_SEATS_AERO_API_KEY` no frontend para chamadas diretas do browser em alguns componentes — são a mesma chave mas com nomes diferentes por causa do Vite.

---

## 9. Railway vs Vercel — Separação Crítica

| | Railway | Vercel |
|--|---------|--------|
| **O que roda** | Node.js Express (`server.js`) | React SPA (build Vite) |
| **Porta** | `PORT` env var (padrão 3001) | N/A (serverless) |
| **Crons** | `node-cron` dentro do processo | N/A |
| **Playwright** | Sim (Chromium no container) | Não |
| **Env vars** | `.env.production` + Railway dashboard | Vercel dashboard |

`VERCEL=1` no env **desativa os crons** no server.js. Nunca definir essa variável no Railway.

O frontend acessa o backend via `VITE_API_BASE_URL` (ex: `https://flywise-backend.up.railway.app`).

---

## 10. Supabase — RLS e Service Role Key

Todas as tabelas de usuário têm RLS habilitado. O backend usa `SUPABASE_SERVICE_ROLE_KEY` (acesso total, bypassa RLS). Nunca expor essa chave no frontend.

O frontend usa `VITE_SUPABASE_ANON_KEY` — opera sob RLS normal. Usuários só veem seus próprios dados.

Nas Edge Functions (Deno), usar o Supabase client com o JWT do usuário (não o service role) para que o RLS funcione corretamente.

---

## 11. URL do Google Flights — Protobuf, não Query String

O scraper não abre `google.com/travel/flights?origin=GRU&dest=SDU`. Usa o parâmetro `tfs` que é um **protobuf codificado em base64url**:

```
https://www.google.com/travel/flights?tfs=<base64url>&hl=pt-BR&gl=BR&curr=BRL
```

O `buildGfTfsUrl()` em `googleFlights.js` faz a codificação manual (varint encoding + base64url sem padding). É o mesmo formato que o botão "Ver no Google Flights" do frontend gera. Não tentar substituir por parâmetros de query — o Google não aceita.

---

## 12. Nomenclatura Mista (PT + EN)

O projeto mistura intencionalmente português e inglês:

- **Domínio de negócio:** português (`origem`, `destino`, `preco_brl`, `milhas`, `programa`)
- **Estruturas técnicas:** inglês (`handleSubmit`, `isLoading`, `fetchData`, `router`, `middleware`)
- **Tabelas do banco:** mistura (`seatsaero_searches`, `user_profiles`, `transfer_promotions`)
- **Endpoints:** inglês (`/api/search-flights`, `/api/award-prices`)

Não "normalizar" para um idioma só — é uma convenção deliberada.

---

## 13. Tiers de Plano

| Tier | Watchlist | Estratégias | Roteiros | Alertas email |
|------|-----------|-------------|----------|---------------|
| `free` | 0 | 3/mês | 1 | Não |
| `essencial` | 3 | 10/mês | 5 | Sim |
| `pro` | 10 | ilimitado | 15 | Sim |
| `elite` | ilimitado | ilimitado | ilimitado | Sim + SMS |
| `admin` | ilimitado | ilimitado | ilimitado | Sim |

Verificação de plano no frontend: `usePlan()` hook + `PLAN_LIMITS` em `src/lib/planLimits.ts`.

Verificação no backend: `getWatchlistLimit()` em `middleware/auth.js`.

Ativação de plano: webhook do AbacatePay → `user_profiles.plan` + `plan_expires_at`.

---

## 14. Tabelas do Banco com Comportamentos Não-Óbvios

| Tabela | Gotcha |
|--------|--------|
| `seatsaero_searches` | Cache de 10min. Lookup por `(origem, destino, data_ida)`. Dados em coluna `dados` como JSON array |
| `watchlist_items` | Soft delete (`active = false`). Não há `DELETE` real |
| `transfer_promotions` | Upsert por `(card_id, program)`. Claude extrai e sobrescreve. Campo `club_tier_bonuses` é JSON |
| `transfer_sync_log` | Auditoria de cada sync. Checar a última entrada para saber quando rodou pela última vez |
| `user_profiles` | `id` = UUID do Supabase Auth. `is_admin = true` dá acesso ao painel admin |
| `award_prices_cache` | Upsert por `category`. Atualizado semanalmente via GitHub Actions ou manualmente |

---

## 15. GitHub Actions — Dois Workflows Automatizados

```
.github/workflows/
├── scraper.yml           # Roda scraper Python 2x/dia (08h e 18h BRT)
└── sync-award-prices.yml # Sync de preços de milhas toda segunda (07h UTC)
```

Mudanças nos scrapers Python afetam produção automaticamente via esses workflows. O sync de promoções JS (`syncTransferData`) também tem cron interno no Railway (`0 14 * * *` UTC) como backup.

---

## 16. `scraper/` tem `node_modules/` próprio

Existe um `scraper/node_modules/` separado do root. Isso pode causar confusão em imports relativos. Os arquivos JS do scraper (`browser.js`, `googleFlights.js`) são importados pelo root Node.js e devem usar os módulos do root `node_modules/`, não os do scraper. Se houver conflito de versão de playwright-extra, verificar qual está sendo carregado.

---

## 17. Sync de Bônus de Transferência — Fluxo Completo

O sync de promoções de transferência alimenta **três pontos** do produto:

```
Cron diário (14h UTC)
  └─ syncTransferData() [routes/admin.js]
       ├─ Scrapa 4 RSS + 1 página web via Playwright (Haiku → Sonnet)
       ├─ Claude Sonnet analisa e detecta mudanças
       ├─ Atualiza transfer_promotions no Supabase
       └─ Invalida cache in-memory (transferPromos.js)
            │
            ├── Carteira (Wallet.tsx)
            │     └─ Lê transfer_promotions direto via Supabase client
            │        Mostra badge "+X% bônus" e borda verde nos programas ativos
            │
            ├── Busca Avançada com IA (chat-busca Edge Function)
            │     └─ Busca transfer_promotions no início de cada conversa
            │        Injeta "BÔNUS DE TRANSFERÊNCIA ATIVOS AGORA" no system prompt
            │
            └── Estratégia de Milhas (strategy Edge Function)
                  └─ Query 3 do fetchPromos() já lê transfer_promotions
                     Calcula ratio efetivo considerando bônus ativo
```

**Status do sync em tempo real:** `GET /api/admin/transfer-sync-status` retorna `_syncState`:
```json
{ "inProgress": true, "step": "analyzing", "startedAt": "...", "lastResult": null }
```
Steps: `scraping` → `analyzing` → `updating` → `done` (ou `error`)

**Fontes atuais (5 fontes, 4 RSS + 1 Playwright):**
1. `rss_pprimeira_bonus` — PdP Bônus de Transferência (RSS, mais específico)
2. `rss_pprimeira_milhas` — PdP Milhas (RSS)
3. `rss_pprimeira` — PdP Feed geral (RSS)
4. `rss_melhores` — Melhores Destinos (RSS)
5. `web_melhorescartoes` — Melhores Cartões `/c/promocoes-milhas` (Playwright, `networkidle`)
   - Upserta artigos novos na tabela `promocoes` (dedup por `url` UNIQUE)
   - Passa conteúdo para Claude analisar `transfer_promotions`

**Modelo:** Claude Sonnet 4.6 (mudado de Haiku em Mai/2025 para melhor extração)

**Diffs no log:** Campo `summary` contém seção `\n\nMUDANÇAS:\n` com linhas de diff (`+` = novo, `~` = atualizado). A aba Logs do admin renderiza isso com highlight monospace.

---

## Histórico de Mudanças Estruturais

| Data | Mudança |
|------|---------|
| Mai/2025 | Refatoração: `server.js` (4.287 linhas) → `server.js` slim (92 linhas) + `routes/*.js` |
| Mai/2025 | `scraper/googleFlights.js` criado (extraído do monolito), `browser.js` criado |
| Mai/2025 | Roteiro: two-pass Sonnet 4.6 (curadoria → itinerário) |
| Mai/2025 | Adicionados toggles de notificação (`noticias`, `compras`) em Configuracoes |
| Mai/2025 | Sync bônus de transferência: Haiku→Sonnet, 4 RSS + Melhores Cartões (Playwright), polling admin, diffs no log, badge na Wallet, contexto no chat-busca |
