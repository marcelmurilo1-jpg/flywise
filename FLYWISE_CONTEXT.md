# FlyWise — Documento de Contexto do Projeto

## Visão Geral

**FlyWise** ("Voe Sábio") é uma plataforma completa de viagens para o mercado brasileiro que consolida busca de passagens, gestão de programas de fidelidade, simulador de transferências, agregador de promoções, estratégias com IA, geração de roteiros e um módulo de intercâmbio médico (C1).

**Proposta de Valor:**
- Preços de voos em BRL em tempo real via scraper do Google Flights
- Disponibilidade de milhas via Seats.aero Partner API
- Estratégias de IA que sugerem o melhor programa de fidelidade para cada voo
- Simulador de transferências com bonificações ativas
- Agregador de promoções com alertas por email
- Gerador de roteiros day-by-day com mapa interativo
- 4 tiers de assinatura: Free, Essencial (R$19/mês), Pro (R$39/mês), Elite (R$69/mês)

---

## Stack Tecnológica

| Camada | Tecnologia |
|---|---|
| Frontend | React 19 + TypeScript + Vite |
| Estilo | Tailwind CSS v4 + Radix UI |
| Animações | Framer Motion, GSAP, Lenis |
| Mapas | React Leaflet + React Simple Maps + D3 Geo |
| Backend/Database | Supabase (auth, PostgreSQL, realtime, storage) |
| API Server | Node.js + Express 5.2 (Railway) |
| Edge Functions | Deno (Supabase Functions) |
| IA | OpenAI GPT-4o-mini via Edge Functions |
| Scraper de Voos | Playwright + Chromium (Railway) + Google Flights |
| API de Milhas | Seats.aero Partner API |
| Scraper de Promoções | Python + Playwright + Railway cron |
| Email | Resend API |
| Pagamentos | PIX via AbacatePay |
| PDF Export | @react-pdf/renderer |
| Deploy Frontend | Vercel |
| Deploy Backend | Railway |
| Database | Supabase Cloud |

---

## Estrutura de Diretórios

```
flywise/
├── src/
│   ├── pages/               # 18 páginas principais
│   │   └── c1/              # Módulo intercâmbio médico
│   ├── components/          # 30+ componentes UI
│   ├── contexts/            # AuthContext, ThemeContext, C1Context
│   ├── hooks/               # usePlan, useAdmin, useIsMobile, useNotificationSurvey
│   ├── lib/
│   │   ├── supabase.ts      # Supabase client & tipos DB
│   │   ├── planLimits.ts    # Configuração dos tiers
│   │   ├── transferData.ts  # Mapeamento de transferências
│   │   └── llm/             # Builders de prompts para LLM
│   └── types/
├── supabase/
│   ├── functions/           # 4 Edge Functions Deno
│   │   ├── strategy/        # Recomendações de estratégia com milhas
│   │   ├── chat-busca/      # Busca avançada com NLP
│   │   ├── itinerary/       # Geração de roteiros
│   │   └── refresh-extras/  # Regenera seção extras do roteiro
│   └── migrations/          # 21 arquivos SQL de migração
├── scraper/
│   ├── run.py               # Entrada principal (scraping + classificação)
│   ├── scrape_passageiro.py # Scraper RSS de promoções
│   ├── notify.py            # Disparador de emails via Resend
│   └── requirements.txt
├── server.js                # Express backend (~3000 linhas, 29 endpoints)
├── Dockerfile               # Build para Railway
├── nixpacks.toml            # Configuração NIXPACKS
├── railway.toml             # Deploy Railway
├── vercel.json              # Routing SPA Vercel
└── .github/workflows/
    ├── scraper.yml          # Roda 2x/dia (08h e 18h BRT)
    └── sync-transfer-data.yml # Diário às 11h BRT
```

---

## Arquivos-Chave

| Arquivo | Função |
|---|---|
| `server.js` | API Express: busca de voos, checkout, admin, cron jobs |
| `src/App.tsx` | React router, rotas protegidas, BottomNav |
| `src/contexts/AuthContext.tsx` | Gerenciamento do estado Supabase auth |
| `src/pages/Resultados.tsx` | Exibição de resultados + filtros |
| `src/pages/StrategyPanel.tsx` | Recomendações de estratégia com IA |
| `src/pages/Wallet.tsx` | Saldos dos programas de fidelidade |
| `src/pages/TransferSimulator.tsx` | Otimização de caminhos de transferência |
| `src/pages/ChatBuscaAvancada.tsx` | Interface de busca em linguagem natural |
| `src/pages/Roteiro.tsx` | Gerador de roteiros + mapa + PDF |
| `src/pages/Planos.tsx` | Seleção de planos |
| `src/pages/Checkout.tsx` | Fluxo de pagamento PIX com QR code |
| `src/pages/Admin.tsx` | Dashboard admin |
| `src/lib/planLimits.ts` | Configuração Free/Essencial/Pro/Elite |
| `supabase/functions/strategy/index.ts` | Edge Function estratégia |
| `supabase/functions/itinerary/index.ts` | Edge Function roteiros |
| `scraper/run.py` | Orquestração principal do scraper |

---

## Variáveis de Ambiente

### Frontend (`.env.local` / `.env.production`)
```env
VITE_SUPABASE_URL=https://cwsjdkucffmiptrfvuxn.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...  # ATENÇÃO: usar chave no formato novo
VITE_API_BASE_URL=https://web-production-c819c.up.railway.app
VITE_AMADEUS_CLIENT_ID=...
VITE_AMADEUS_CLIENT_SECRET=...
VITE_SEATS_AERO_API_KEY=...
```

### Backend (Railway)
```env
SUPABASE_URL=https://cwsjdkucffmiptrfvuxn.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
SEATS_AERO_API_KEY=...
SYNC_SECRET=...       # Header auth para endpoints admin
OPENAI_API_KEY=...
NODE_ENV=production
PORT=3001
PLAYWRIGHT_BROWSERS_PATH=/app/.playwright-browsers
```

### Scraper (`.env` Python)
```env
DATABASE_URL=postgresql://postgres:[password]@db.cwsjdkucffmiptrfvuxn.supabase.co:5432/postgres
RESEND_API_KEY=...
FROM_EMAIL=...
```

### Edge Functions (Supabase Secrets)
```env
OPENAI_API_KEY
SEATS_AERO_API_KEY
# SUPABASE_SERVICE_ROLE_KEY e SUPABASE_URL são auto-injetados
```

> **ATENÇÃO CRÍTICA:** A Supabase migrou para novo formato de chave (`sb_publishable_...`). Edge Functions requerem `--no-verify-jwt` no deploy + validação manual via `getUser()`. Sem isso, todas as chamadas retornam 401.

---

## Schema do Banco de Dados (21 Migrações)

| Tabela | Função | Campos-Chave |
|---|---|---|
| `buscas` | Histórico de buscas | user_id, origem, destino, data_ida, data_volta, user_miles (JSONB) |
| `resultados_voos` | Resultados de busca | busca_id, companhia, preco_brl, preco_milhas, origem, destino |
| `strategies` | Estratégias geradas pela IA | busca_id, user_id, strategy_text, economia_pct, preco_cash |
| `itineraries` | Roteiros gerados | user_id, destination, days, content (JSONB), budget_category |
| `promocoes` | Promoções do scraper | titulo, url (UNIQUE), categoria, subcategoria, programas_tags (array) |
| `user_profiles` | Dados estendidos do usuário | id (UUID), full_name, plan, plan_expires_at, plan_billing, is_admin, cpf |
| `notification_preferences` | Configurações de alertas | user_id, notificacoes_ativas, passagens, milhas, programas (array) |
| `user_promotion_log` | Controle de envios | user_id, promotion_id, sent_at |
| `seatsaero_searches` | Cache de busca de milhas | origem, destino, dados (JSONB), criado_em (TTL: 10min) |
| `chat_conversations` | Histórico de chat | user_id, title, wizard_data (JSONB), messages (JSONB) |
| `visited_countries` | Mapa de viagens | user_id, country_code, status ('visited'/'wishlist') |
| `transfer_promotions` | Bonificações de transferência | card_id, program, bonus_percent, club_tier_bonuses (JSONB), valid_until |
| `award_prices_cache` | Cache de preço em milhas | route, cabin, date_reference, price_miles (TTL: semanal) |
| `admin_costs` | Custos operacionais | month, service, category, amount_brl |
| `itinerary_research` | Cache de pesquisa web | destination (PK), snippets (JSONB) (TTL: 7 dias) |

**Segurança:** RLS habilitado em todas as tabelas de usuário. Planos não podem ser auto-elevados (apenas service_role).

---

## Features Implementadas

1. **Busca de Voos em Tempo Real** — Cash (Google Flights scraper) + Milhas (Seats.aero), ida+volta paralelo, cache LRU 4h
2. **Estratégia com IA** — GPT-4o-mini analisa voo + milhas do usuário + promos ativas → recomenda melhor programa, CPM, economia vs. cash
3. **Chat de Busca Avançada** — NLP extrai aeroportos/datas/cabine de linguagem natural, histórico por usuário
4. **Wallet de Fidelidade** — Saldos em 16+ programas: Smiles, LATAM Pass, TudoAzul, Livelo, Aeroplan, Flying Blue, etc.
5. **Simulador de Transferências** (Pro/Elite) — Melhores caminhos entre programas, bonificações de clube por tier
6. **Agregador de Promoções** — RSS 2x/dia, classificação automática (milhas/passagens), sub-categorias, tagging por programa
7. **Alertas por Email** — Matching com preferências do usuário via Resend, deduplicação via user_promotion_log
8. **Gerador de Roteiros** — GPT-4o-mini, day-by-day, mapa Leaflet, schema dinâmico (2 dias detalhado vs. 7+ compacto), PDF export
9. **Módulo C1 (Intercâmbio Médico)** — Explorar destinos, workflow 4 etapas (Docs → Emails → Onboarding → Pré-Partida)
10. **Mapa de Viagens** — Países visitados/wishlist, estatísticas por continente, D3 Geo
11. **Planos e Billing** — PIX via AbacatePay, QR code, webhook, annual discount, gates por feature
12. **Dashboard Admin** — Usuários, custos, MRR/churn/ARR, DAU, saúde das APIs, sync logs

---

## Endpoints da API (29 total)

### Busca
- `POST /api/search-flights` — Seats.aero wrapper (ida + volta paralelo)
- `GET /api/amadeus/airports` — Autocomplete de aeroportos
- `GET /api/amadeus/flights` — Scraper Google Flights

### Pagamentos
- `POST /api/checkout` — Iniciar pagamento PIX
- `GET /api/checkout/status/:id` — Status do pagamento (polling)
- `POST /api/webhook/abacatepay` — Webhook de confirmação
- `POST /api/checkout/activate` — Ativação de plano server-side

### Milhas e Transferências
- `GET /api/award-prices` — Preços de milhas em rotas de referência
- `POST /api/award-prices/sync` — Sync manual (protegido por header)
- `GET /api/transfer-promotions` — Dados de bonificações (cache 12h)
- `POST /api/transfer-promotions/update` — Força refresh

### Admin (todos requerem autenticação)
- `GET /api/health` — Health check Railway
- `GET /api/admin/stats` — Métricas gerais
- `GET /api/admin/users` — Lista de usuários com plano
- `PATCH /api/admin/users/:id/plan` — Alterar plano do usuário
- `GET /api/admin/revenue` — MRR, churn, ARR, alertas de expiração
- `GET /api/admin/engagement` — DAU, novos usuários, top destinos
- `GET /api/admin/api-status` — Saúde das APIs externas
- `POST /api/admin/sync-transfer-data` — Sync assíncrono de transferências
- `GET /api/admin/transfer-sync-log` — Histórico de sync
- `GET /api/admin/costs` — Custos (6 meses)
- `POST /api/admin/costs` — Adicionar custo
- `DELETE /api/admin/costs/:id` — Remover custo

---

## Serviços Externos

| Serviço | Finalidade | Auth |
|---|---|---|
| **Supabase** | DB, Auth, Storage, Edge Functions | Service Role Key, Anon Key |
| **Google Flights** | Preços em BRL em tempo real | Scraper (sem API) — Playwright + Stealth |
| **Seats.aero Partner API** | Disponibilidade de milhas e award pricing | API Key no header |
| **Amadeus API** | Autocomplete de aeroportos | Client ID + Secret (OAuth) |
| **OpenAI** | GPT-4o-mini para estratégia, roteiro, chat | OPENAI_API_KEY (Edge Function secret) |
| **Resend** | Alertas de promoções por email | RESEND_API_KEY (scraper Python) |
| **AbacatePay** | Processamento PIX | Webhook integration |
| **Railway** | Hosting backend + scraper | GitHub OAuth |
| **Vercel** | Hosting frontend | GitHub OAuth |
| **GitHub Actions** | Automação scraper + sync transferências | Repository secrets |

---

## Deploy

### Frontend (Vercel)
- Trigger: push para `main`
- Build: `tsc -b && vite build`
- Output: `dist/` (~11MB)
- SPA routing via `vercel.json`

### Backend (Railway)
- Builder: NIXPACKS + Dockerfile Alpine
- Start: `node server.js`
- Health check: `/health` (30s timeout)
- URL: `https://web-production-c819c.up.railway.app`
- Cron jobs internos:
  - Semanal (segunda 04h BRT): sync award prices
  - Diário (11h BRT): sync transfer data

### Automação (GitHub Actions)
- **Scraper:** 2x/dia (08h e 18h BRT) — `python run.py` + `python notify.py`
- **Transfer Sync:** 1x/dia (11h BRT) — chama Railway `/api/admin/sync-transfer-data` com `x-sync-secret`

### Banco (Supabase Cloud)
- 21 migrações em `supabase/migrations/`
- Deploy de Edge Functions: `supabase functions deploy <nome> --no-verify-jwt`

---

## Estratégia de Cache

| Dado | TTL | Mecanismo |
|---|---|---|
| Google Flights | 4 horas | LRU in-memory (max 300 entradas) |
| Seats.aero | 10 minutos | Tabela `seatsaero_searches` |
| Award Prices | Semanal | Tabela `award_prices_cache` |
| Transfer Promotions | 12 horas | In-memory no server.js |
| Itinerary Research | 7 dias | Tabela `itinerary_research` |

---

## Autenticação e Segurança

- Email + senha via Supabase Auth
- Google OAuth
- JWT validation para endpoints admin (`requireAdminJWT` middleware)
- `x-sync-secret` header para tarefas agendadas
- RLS em todas as tabelas de usuário
- Plano e flag admin não podem ser auto-elevados
- Service role key usada apenas no backend/scraper

---

## Scripts npm

```bash
npm run dev          # Vite dev server (porta 5173)
npm run start        # Express production server
npm run dev:all      # Backend + frontend simultâneos (concurrently)
npm run build        # TypeScript compile + Vite build
npm run lint         # ESLint
```

---

## Avisos e Gotchas Importantes

1. **Supabase New Key Format** — Chaves `sb_publishable_...` quebram a verificação JWT do gateway. Sempre usar `--no-verify-jwt` no deploy de Edge Functions e validar manualmente via `supabaseClient.auth.getUser()`.
2. **Playwright no Railway** — Chromium é instalado em background no postinstall. O servidor sobe antes do browser estar pronto; há lógica de retry para aguardar.
3. **Token Limits (Itinerário)** — Schema compacto é usado automaticamente para roteiros > 3 dias para respeitar o limite de 8192 tokens do modelo.
4. **Rate Limiting Seats.aero** — API retorna 429 em excesso de requisições; cache de 10 min é essencial para não bloquear.
5. **Admin vs. Service Role** — Nunca expor `SUPABASE_SERVICE_ROLE_KEY` no frontend. Toda escrita privilegiada passa pelo `server.js`.
