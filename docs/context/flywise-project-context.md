# FlyWise — Contexto do Projeto

> Arquivo de orientação para Claude e desenvolvedores. Atualizado ao final de cada sessão significativa.

---

## O que é o FlyWise

App web para brasileiros que querem usar milhas aéreas com inteligência.
O usuário informa sua carteira de milhas/pontos, busca voos, e a IA gera uma estratégia personalizada:
qual programa usar, como transferir pontos, se vale mais a pena pagar em dinheiro.

---

## Tech Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React + TypeScript + Vite + Tailwind CSS |
| Backend (Express) | Node.js — Railway (auto-deploy via git push) |
| Edge Functions | Deno — Supabase |
| Banco de dados | Supabase (PostgreSQL) |
| API de milhas | Seats.aero (disponibilidade award) |
| Preços cash | Google Flights scraper (Playwright) |
| IA estratégia | GPT-4o-mini via OpenAI |
| IA busca avançada | Claude Haiku 4.5 (buscas) + Sonnet 4.6 (análise) |

---

## Mapa de Arquivos Chave

```
Fly Wise/
├── server.js                          ← Ponto de entrada Express
├── routes/
│   ├── seats.js                       ← Seats.aero: busca, discover, booking link
│   │                                    ⚠️ É .js — NUNCA adicionar TS annotations
│   └── amadeus.js                     ← Google Flights (ponte para scraper)
├── scraper/
│   └── googleFlights.js               ← Playwright scraper do Google Flights
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
│   └── lib/llm/
│       ├── buildPrompt.ts             ← Monta prompt simples (legacy)
│       └── buildPromoContext.ts       ← Busca promos e monta contexto LLM
├── supabase/
│   ├── functions/
│   │   ├── strategy/
│   │   │   ├── index.ts               ← Edge Function de estratégia (~1732 linhas)
│   │   │   └── prompts/
│   │   │       └── system.ts          ← Prompt do sistema (extraído do index.ts)
│   │   └── chat-busca/
│   │       ├── index.ts               ← Edge Function de busca avançada
│   │       └── prompts/
│   │           ├── instructions-busca.ts      ← Instruções modo busca normal
│   │           └── instructions-para-onde.ts  ← Instruções modo "para onde"
│   └── migrations/
│       └── 036_knowledge_base.sql     ← Tabelas knowledge_base + knowledge_inbox
├── knowledge/                         ← Vault Obsidian (knowledge base de domínio)
│   ├── programs/                      ← Sweet spots por programa
│   ├── concepts/                      ← CPM, quando vale a pena, etc.
│   ├── routing/                       ← Dicas por rota
│   └── alliances/                     ← Alianças e parcerias
├── scripts/
│   └── sync-knowledge.js              ← Sync vault Obsidian → Supabase
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
- **Estratégia de milhas**: GPT-4o-mini calcula CPM, compara programas, gera passos executáveis
- **Busca avançada (chat)**: Claude Haiku faz buscas → Sonnet escreve análise final (streaming)
- **Para onde posso voar**: descobre destinos alcançáveis com a carteira do usuário
- **Booking links**: link direto ao site do programa via Seats.aero `/trips` API
- **Knowledge base**: vault Obsidian sincronizado ao Supabase, injetado nas Edge Functions via RAG
- **Planos de acesso**: free (1 estratégia lifetime), essencial (3/mês), pro (5/mês), elite (10/mês)

---

## Armadilhas e Cuidados

| Arquivo | Cuidado |
|---|---|
| `routes/seats.js` | É `.js` puro — TS annotations (`: type`) causam `SyntaxError` e quebram **todas** as rotas |
| `strategy/index.ts` | `vale_a_pena` é calculado server-side — o LLM **não pode** mudar esse valor |
| `strategy/index.ts` | Transferência de pontos é **irreversível** — steps sempre confirmam disponibilidade antes de transferir |
| `chat-busca/index.ts` | Dois modelos em série: Haiku faz tool-use (buscas) → Sonnet escreve análise |
| Promoções | Duas fontes: promos manuais (`programa` field) + scraper (`programas_tags` array) |
| Seats.aero | Cada programa tem estoque **separado** de assentos — milhas de programas diferentes não são equivalentes |

---

## Convenções

- Migrações: `0NN_nome.sql` sequenciais em `supabase/migrations/`
- Deploy backend: `npm start` → `node server.js` no Railway
- Deploy Edge Functions: `supabase functions deploy <nome> --no-verify-jwt`
- Cache Seats.aero: 10 min TTL em `seatsaero_searches`
- Cache estratégias: 24h TTL em `strategies` (por user_id + seatsKey)

---

## Dados Hardcoded Importantes em strategy/index.ts

Estes dados estruturais ficam no código — candidatos futuros ao knowledge base:

- `AIRLINE_PROGRAMS` — quais programas aceitam cada IATA (ex: `G3` → Smiles, Livelo)
- `TRANSFER_BASES` — quais cartões/bancos transferem para cada programa e em qual ratio base
- `BANK_COST_PER_K` — custo estimado de comprar 1.000 pts de cada banco (R$)
- `BASE_COST_PER_K` — custo estimado de comprar 1.000 milhas de cada programa (R$)
- `TAXES_BY_PROGRAM` — taxas estimadas por programa (R$)

---

## Mudanças Recentes

### 2026-05-14 — Knowledge Base + Prompt Management
- **Corrigido bug crítico**: `routes/seats.js` tinha `(l: any)` (TS annotation em arquivo .js) — quebrava todos os endpoints Seats.aero
- **Novo**: link Google Flights em `StrategyContent.tsx` quando `vale_a_pena === false` (dinheiro é melhor que milhas)
- **Novo**: prompts extraídos de `strategy/index.ts` e `chat-busca/index.ts` para `prompts/*.ts` — editáveis sem tocar lógica de negócio
- **Novo**: migration `036_knowledge_base.sql` — tabelas `knowledge_base` e `knowledge_inbox`
- **Novo**: `scripts/sync-knowledge.js` — sincroniza vault Obsidian → Supabase
- **Novo**: `fetchKnowledge()` em ambas as Edge Functions — injeta contexto do knowledge base no prompt via RAG por tags
- **Novo**: `knowledge/` — vault inicial com notas seed (Smiles, LATAM Pass, conceito CPM)
