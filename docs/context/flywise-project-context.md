# FlyWise — Contexto do Projeto

> Arquivo de orientação para Claude e desenvolvedores. Atualizado ao final de cada sessão significativa.

---

## O que é o FlyWise

App web para brasileiros que querem usar milhas aéreas com inteligência.
O usuário informa sua carteira de milhas/pontos, busca voos, e a IA gera uma estratégia personalizada:
qual programa usar, como transferir pontos, se vale mais a pena pagar em dinheiro.

Produto em produção ativa. Desenvolvedor = fundador e único engenheiro.

---

## Tech Stack

| Camada            | Tecnologia                                       |
| ----------------- | ------------------------------------------------ |
| Frontend          | React + TypeScript + Vite + Tailwind CSS v4      |
| Backend (Express) | Node.js — Railway (auto-deploy via git push)     |
| Edge Functions    | Deno — Supabase                                  |
| Banco de dados    | Supabase (PostgreSQL)                            |
| API de milhas     | Seats.aero (disponibilidade award)               |
| Preços cash       | Google Flights scraper (Playwright)              |
| IA estratégia     | Claude Haiku 4.5 (Anthropic)                     |
| IA busca avançada | Claude Haiku 4.5 (buscas) + Sonnet 4.6 (análise) |
| IA sync promoções | Claude Sonnet 4.6 (extração de RSS/blogs)        |
| Pagamento         | AbacatePay (PIX + cartão, webhook assíncrono)    |

---

## Deploy — Railway vs Vercel

| | Railway | Vercel |
|--|---------|--------|
| **O que roda** | Node.js Express (`server.js`) | React SPA (build Vite) |
| **Porta** | `PORT` env var (padrão 3001) | N/A (serverless) |
| **Crons** | `node-cron` dentro do processo | N/A |
| **Playwright** | Sim (Chromium baked na imagem Docker) | Não |
| **Env vars** | `.env.production` + Railway dashboard | Vercel dashboard |

`VERCEL=1` no env **desativa os crons** no server.js. Nunca definir essa variável no Railway.

O frontend acessa o backend via `VITE_API_BASE_URL` (ex: `https://flywise-backend.up.railway.app`).

---

## Mapa de Arquivos Chave

```
Fly Wise/
├── server.js                          ← Entry point slim (~92 linhas). Só init, crons, listen
├── server.old.js                      ← Backup do monolito antigo — NÃO usar como referência
├── routes/
│   ├── seats.js                       ← Seats.aero: busca, discover, booking link
│   │                                    ⚠️ É .js — NUNCA adicionar TS annotations
│   ├── amadeus.js                     ← Google Flights (ponte para scraper)
│   ├── watchlist.js                   ← /api/watchlist (CRUD + sync)
│   ├── payments.js                    ← /api/payments + webhook AbacatePay
│   ├── awardPrices.js                 ← /api/award-prices
│   ├── transferPromos.js              ← /api/transfer-promotions (cache in-memory)
│   └── admin.js                       ← /api/admin/* (sync, stats, users, posts)
├── scraper/
│   ├── browser.js                     ← Playwright browser manager (Google Flights)
│   ├── googleFlights.js               ← Extração de preços Google Flights
│   ├── airlineMaps.js                 ← Mapas IATA → nome da cia/cidade
│   ├── run.py                         ← Orquestrador: chama Passageiro + Melhores Destinos (GitHub Actions 2x/dia)
│   ├── scrape_passageiro.py           ← Scraper site Passageiro de Primeira
│   ├── scrape_melhores_destinos.py    ← Scraper site Melhores Destinos
│   └── notify.py                      ← Emails de alerta via Resend
├── middleware/
│   └── auth.js                        ← requireAdminJWT, getWatchlistLimit
├── lib/
│   ├── seatsAero.js                   ← Funções de acesso API Seats.aero
│   └── supabase.js                    ← Cliente Supabase (lado Express)
├── src/
│   ├── pages/
│   │   ├── Resultados.tsx             ← Página de resultados de busca
│   │   ├── StrategyDetail.tsx         ← Detalhe da estratégia gerada
│   │   └── ChatBusca.tsx             ← Busca avançada com IA (chat)
│   ├── components/
│   │   ├── FlightResultsGrouped.tsx   ← Lista de voos agrupados por programa
│   │   └── StrategyContent.tsx        ← Exibe estratégia da IA
│   └── lib/
│       ├── planLimits.ts              ← PLAN_LIMITS + usePlan() hook
│       └── llm/
│           └── buildPromoContext.ts   ← Busca promos e monta contexto LLM
├── supabase/
│   ├── functions/
│   │   ├── strategy/
│   │   │   ├── index.ts               ← Edge Function de estratégia
│   │   │   └── prompts/system.ts      ← Prompt do sistema (extraído)
│   │   ├── chat-busca/
│   │   │   ├── index.ts               ← Edge Function de busca avançada
│   │   │   └── prompts/
│   │   │       ├── instructions-busca.ts
│   │   │       └── instructions-para-onde.ts
│   │   ├── itinerary/
│   │   │   └── index.ts               ← Edge Function de roteiros (Claude Sonnet 4.6)
│   │   └── refresh-extras/
│   │       └── index.ts               ← Atrações extras para roteiros (Claude Haiku 4.5)
│   └── migrations/                    ← 036 migrations. Nomear: NNN_descricao.sql
├── knowledge/                         ← Vault Obsidian (knowledge base de domínio)
│   ├── programs/                      ← Sweet spots por programa
│   ├── concepts/                      ← CPM, quando vale a pena, etc.
│   ├── routing/                       ← Dicas por rota
│   └── alliances/                     ← Alianças e parcerias
├── scripts/
│   └── sync-knowledge.js              ← Sync vault Obsidian → Supabase
├── .github/workflows/
│   ├── scraper.yml                    ← Scraper Python 2x/dia (08h e 18h BRT)
│   ├── sync-award-prices.yml          ← Sync preços toda segunda (07h UTC)
│   ├── sync-transfer-data.yml         ← Sync bônus de transferência
│   ├── watchlist-check.yml            ← Verifica alertas da watchlist
│   └── refetch.yml                    ← Reprocessa posts existentes
└── docs/
    ├── context/
    │   └── flywise-project-context.md ← Este arquivo
    └── superpowers/
        ├── specs/                     ← Design docs
        └── plans/                     ← Planos de implementação
```

---

## Funcionalidades Ativas

- **Busca de voos**: Google Flights (preços cash) + Seats.aero (milhas award)
- **Estratégia de milhas**: Claude Haiku 4.5 calcula CPM, compara programas, gera passos executáveis
- **Busca avançada (chat)**: Claude Haiku faz buscas → Sonnet escreve análise final (streaming)
- **Para onde posso voar**: descobre destinos alcançáveis com a carteira do usuário
- **Booking links**: link direto ao site do programa via Seats.aero `/trips` API
- **Knowledge base**: vault Obsidian sincronizado ao Supabase, injetado nas Edge Functions via RAG
- **Sync bônus de transferência**: Claude Sonnet extrai promoções de RSS/blogs diariamente
- **Roteiros de viagem**: Claude Sonnet 4.6 gera itinerário day-by-day + atrações extras via `refresh-extras/`
- **Planos de acesso**: free (1 estratégia lifetime) / essencial (3/mês) / pro (5/mês) / elite (10/mês) / admin

---

## Tiers de Plano

| Tier | Watchlist | Estratégias | Alertas email |
|------|-----------|-------------|---------------|
| `free` | 0 | 1 lifetime | Não |
| `essencial` | 3 | 3/mês | Sim |
| `pro` | 10 | 5/mês | Sim |
| `elite` | 999 | 10/mês | Sim |
| `admin` | 999 | ilimitado | Sim |

Verificação no frontend: `usePlan()` + `PLAN_LIMITS` em `src/lib/planLimits.ts`.
Verificação no backend: `getWatchlistLimit()` em `middleware/auth.js`.
Ativação: webhook AbacatePay → `user_profiles.plan` + `plan_expires_at`.

---

## Dois Sistemas de IA

| Feature | Modelo | Onde roda |
|---------|--------|-----------|
| Estratégias de milhas | Claude Haiku 4.5 | Edge Function `strategy/` |
| Busca avançada / para onde | Claude Haiku 4.5 + Sonnet 4.6 | Edge Function `chat-busca/` |
| Roteiros day-by-day | Claude Sonnet 4.6 | Edge Function `itinerary/` |
| Atrações extras (roteiros) | Claude Haiku 4.5 | Edge Function `refresh-extras/` |
| Sync promoções transferência | Claude Sonnet 4.6 | Node.js Express (`routes/admin.js`) |

Todas as Edge Functions usam `ANTHROPIC_API_KEY`. Zero dependência de OpenAI.

---

## Dois Scrapers em `scraper/`

| Arquivo                           | Linguagem            | Onde roda                   |
| --------------------------------- | -------------------- | --------------------------- |
| `browser.js` + `googleFlights.js` | Node.js (Playwright) | Processo Express no Railway |
| `run.py` + `scrape_passageiro.py` | Python               | GitHub Actions (2x/dia)     |

O scraper Python acessa Supabase diretamente via `DATABASE_URL` (PostgreSQL) — não passa pelo Express.
O scraper JS roda dentro do processo Express via Playwright/Chromium.
`scraper/` tem `node_modules/` próprio — pode causar conflito de versão com o root.

---

## Fluxo de Sync de Bônus de Transferência

```
Cron diário (14h UTC) ou manual via /api/admin/sync-transfer
  └─ syncTransferData() [routes/admin.js]
       ├─ Scrapa 4 RSS + 1 página web (Playwright)
       ├─ Claude Sonnet 4.6 analisa e extrai promoções
       ├─ Upsert em transfer_promotions (por card_id + program)
       └─ Invalida cache in-memory (transferPromos.js)
            ├── Wallet.tsx — badge "+X% bônus" nos programas ativos
            ├── chat-busca — injeta "BÔNUS ATIVOS AGORA" no system prompt
            └── strategy — ratio efetivo considera bônus ativo no cálculo
```

Status em tempo real: `GET /api/admin/transfer-sync-status`
Steps: `scraping` → `analyzing` → `updating` → `done` (ou `error`)

---

## Armadilhas e Cuidados

| Contexto | Cuidado |
|---|---|
| `routes/seats.js` | É `.js` puro — TS annotations (`: type`) causam `SyntaxError` e quebram **todas** as rotas |
| `strategy/index.ts` | `vale_a_pena` é calculado server-side — o LLM **não pode** mudar esse valor |
| `strategy/index.ts` | Transferência de pontos é **irreversível** — steps confirmam disponibilidade antes de transferir |
| `chat-busca/index.ts` | Dois modelos em série: Haiku faz tool-use (buscas) → Sonnet escreve análise |
| Promoções | Duas fontes: promos manuais (`programa` field) + scraper (`programas_tags` array) |
| Seats.aero | 429 é normal. Cache de 10min em `seatsaero_searches` **não é opcional** — sem ele o app para |
| Seats.aero | Cada programa tem estoque **separado** — milhas de programas diferentes não são equivalentes |
| Edge Functions | Deploy sempre com `--no-verify-jwt` + validação manual via `auth.getUser(token)` |
| AbacatePay | Pagamento é **assíncrono** — confirmação chega via webhook, nunca no retorno do POST /checkout |
| Playwright | `PLAYWRIGHT_BROWSERS_PATH` deve ser definido **antes** de qualquer `import 'playwright-extra'` |
| Playwright | `_browser` é privado — usar `clearBrowserRef()` / `getBrowserRef()` de `browser.js` |
| Playwright | `page.evaluate()` roda no browser — variáveis Node.js precisam ser passadas como argumento |
| Google Flights | URL usa parâmetro `tfs` (protobuf em base64url) — não aceita query strings convencionais |
| Railway | `VERCEL=1` desativa os crons — nunca definir essa variável no Railway |
| Supabase RLS | Backend usa `SUPABASE_SERVICE_ROLE_KEY` (bypassa RLS). Frontend usa `VITE_SUPABASE_ANON_KEY` |
| GitHub Actions | 5 workflows — mudanças em `scraper/*.py` afetam produção automaticamente |

---

## Tabelas do Banco com Comportamentos Não-Óbvios

| Tabela | Comportamento |
|--------|---------------|
| `seatsaero_searches` | Cache 10min. Lookup por `(origem, destino, data_ida)`. Dados em coluna `dados` (JSON array) |
| `watchlist_items` | Soft delete (`active = false`). Sem `DELETE` real |
| `transfer_promotions` | Upsert por `(card_id, program)`. Claude sobrescreve. `club_tier_bonuses` é JSON |
| `transfer_sync_log` | Auditoria de cada sync. Campo `summary` contém diffs com `+` (novo) e `~` (atualizado) |
| `user_profiles` | `id` = UUID do Supabase Auth. `is_admin = true` dá acesso ao painel admin |
| `award_prices_cache` | Upsert por `category`. Atualizado semanalmente via GitHub Actions |
| `knowledge_base` | Sync via Obsidian → `scripts/sync-knowledge.js`. Soft delete (`active = false`) |

---

## Convenções de Código

- **Nomes em português** para variáveis de domínio (`origem`, `destino`, `preco_brl`, `milhas`)
- **Nomes em inglês** para estruturas técnicas (`handleSubmit`, `isLoading`, `fetchData`)
- ESModules (`import/export`) em todo o backend — sem `require()`
- Migrações: `NNN_nome.sql` sequenciais em `supabase/migrations/`
- Deploy backend: `npm start` → `node server.js` no Railway
- Deploy Edge Functions: `supabase functions deploy <nome> --no-verify-jwt`
- Cache Seats.aero: 10 min TTL em `seatsaero_searches`
- Cache estratégias: 24h TTL em `strategies` (por user_id + seatsKey)
- Novos endpoints: `/api/<recurso>` com tratamento de erro e status HTTP correto

---

## Dados Hardcoded em strategy/index.ts

Estruturas que ficam no código (candidatos futuros ao knowledge base):

- `AIRLINE_PROGRAMS` — quais programas aceitam cada IATA (ex: `G3` → Smiles, Livelo)
- `TRANSFER_BASES` — quais cartões/bancos transferem para cada programa e em qual ratio base
- `BANK_COST_PER_K` — custo estimado de comprar 1.000 pts de cada banco (R$)
- `BASE_COST_PER_K` — custo estimado de comprar 1.000 milhas de cada programa (R$)
- `TAXES_BY_PROGRAM` — taxas estimadas por programa (R$)

---

## Design System

**Fonte principal:** Inter (todo o UI). **Fonte secundária:** Manrope (destaques e modais).

**Paleta principal:**

| Nome | Hex | Uso |
|---|---|---|
| Blue Vibrant | `#2A60C2` | CTAs primários, botões, links |
| Blue Medium | `#4A90E2` | Ícones ativos, destaques |
| Blue Navy | `#0E2A55` | Headings, textos escuros, fundos navy |
| Snow | `#F7F9FC` | Cards, painéis, superfícies |
| Text Body | `#2C3E6B` | Corpo de texto |
| Text Muted | `#6B7A99` | Labels, textos secundários |

**Estilo visual:** Light mode exclusivo. Minimalista com profundidade via sombras sutis. Bordas arredondadas (cards 16px, botões 12px, inputs 10px). Hover sempre `translateY(-1px ou -2px)` + sombra mais intensa. Animações `0.15s–0.55s ease`. Bottom nav fixa no mobile, breakpoint principal em 768px.

---

## Histórico de Sessões

O histórico de mudanças fica em `docs/context/sessions/` — um arquivo por data.
Este arquivo reflete apenas o **estado atual** do projeto.

Última sessão: [2026-05-14](sessions/2026-05-14.md)
