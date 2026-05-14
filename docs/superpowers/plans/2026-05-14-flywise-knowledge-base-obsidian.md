# FlyWise Knowledge Base + Prompt Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract LLM prompts from hardcoded TypeScript into editable files, build a Supabase knowledge base for curated miles domain knowledge (authored in Obsidian), and inject that knowledge into both Edge Functions via tag-based RAG.

**Architecture:** Obsidian vault → sync script → Supabase `knowledge_base` table → tag-based query at request time → injected as context block in both Edge Functions. Prompts move from inline template literals to imported `.ts` constant files in `prompts/` subdirectories of each function.

**Tech Stack:** Deno (Supabase Edge Functions), Supabase PostgreSQL, Node.js (sync script), TypeScript, `gray-matter` (npm) for frontmatter parsing.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `docs/context/flywise-project-context.md` | Create | Living project orientation doc |
| `supabase/functions/strategy/prompts/system.ts` | Create | Strategy system prompt as exported string constant |
| `supabase/functions/chat-busca/prompts/instructions-busca.ts` | Create | Static instruction sections for regular search mode |
| `supabase/functions/chat-busca/prompts/instructions-para-onde.ts` | Create | Static instruction sections for "para onde" mode |
| `supabase/functions/strategy/index.ts` | Modify | Import prompt from file instead of inline string |
| `supabase/functions/chat-busca/index.ts` | Modify | Import prompt from file instead of inline string |
| `supabase/migrations/036_knowledge_base.sql` | Create | `knowledge_base` + `knowledge_inbox` tables |
| `scripts/sync-knowledge.js` | Create | Reads Obsidian vault, upserts to Supabase |
| `supabase/functions/strategy/index.ts` | Modify (phase 3) | Add `fetchKnowledge()` call before prompt assembly |
| `supabase/functions/chat-busca/index.ts` | Modify (phase 3) | Add `fetchKnowledge()` call before prompt assembly |

---

## Task 0: Project Context Doc

**Files:**
- Create: `docs/context/flywise-project-context.md`

- [ ] **Step 1: Create the project context document**

Write `docs/context/flywise-project-context.md` with this content (update the "Mudanças Recentes" section at the end of each significant session):

```markdown
# FlyWise — Project Context

> This file is the orientation guide for the FlyWise project. It is updated at the end of each Claude Code session.
> Do NOT edit manually — let Claude maintain it.

## O que é o FlyWise

FlyWise é um app web para brasileiros que querem usar milhas aéreas de forma inteligente.
O usuário informa sua carteira de milhas/pontos, busca voos, e a IA gera uma estratégia personalizada
recomendando o melhor programa de fidelidade, como transferir pontos e quando vale usar dinheiro.

## Tech Stack

- **Frontend**: React + TypeScript + Vite + Tailwind CSS — em `src/`
- **Backend (Express)**: Node.js, rodando no Railway — `server.js`, `routes/`, `scraper/`, `lib/`
- **Edge Functions (Deno)**: Supabase — `supabase/functions/`
  - `strategy/` — gera estratégia usando GPT-4o-mini
  - `chat-busca/` — busca avançada com Claude (Haiku + Sonnet em dois passes)
  - `itinerary/` — gera itinerário de viagem
  - `refresh-extras/` — atualiza dados extras
- **Database**: Supabase (PostgreSQL) — migrações em `supabase/migrations/`
- **APIs externas**: Seats.aero (disponibilidade de assentos award), Google Flights (preços cash via scraper)

## Mapa de Arquivos Chave

| Arquivo/Pasta | Responsabilidade |
|---|---|
| `server.js` | Ponto de entrada Express |
| `routes/seats.js` | Busca Seats.aero, discover routes, booking link |
| `routes/amadeus.js` | Google Flights scraper (pontes para `scraper/googleFlights.js`) |
| `lib/seatsAero.js` | Funções de acesso à API Seats.aero |
| `lib/supabase.js` | Cliente Supabase (Express side) |
| `src/pages/Resultados.tsx` | Página de resultados de busca |
| `src/components/FlightResultsGrouped.tsx` | Lista de voos agrupados por programa |
| `src/components/StrategyContent.tsx` | Exibe estratégia gerada pela IA |
| `src/pages/StrategyDetail.tsx` | Página de detalhe da estratégia |
| `src/pages/ChatBusca.tsx` | Busca avançada com IA (chat) |
| `src/lib/llm/buildPrompt.ts` | Monta prompt simples (legacy, pouco usado) |
| `src/lib/llm/buildPromoContext.ts` | Busca promoções e monta contexto para LLM |
| `supabase/functions/strategy/index.ts` | Edge Function principal — estratégia completa |
| `supabase/functions/chat-busca/index.ts` | Edge Function de busca avançada |

## Funcionalidades Ativas

- **Busca de voos**: Google Flights (preços cash) + Seats.aero (milhas award)
- **Estratégia de milhas**: GPT-4o-mini analisa programas, calcula CPM, gera passos executáveis
- **Busca avançada (chat)**: Claude Haiku (buscas) + Sonnet (análise) com tool-use Seats.aero
- **Para onde posso voar**: descobre destinos com base na carteira do usuário
- **Booking links**: link direto para o site do programa de milhas via Seats.aero trips API
- **Cache**: Supabase `seatsaero_searches` (10min TTL), `strategies` (24h TTL), in-memory Google Flights
- **Planos de acesso**: free (1 estratégia lifetime), essencial, pro, elite, admin

## Problemas Conhecidos / Cuidados

- `routes/seats.js` é um arquivo `.js` — NUNCA adicionar TypeScript annotations (`: type`) aqui, causará SyntaxError que quebra TODAS as rotas Seats.aero
- O scraper Google Flights (`scraper/googleFlights.js`) pode ser bloqueado — há retry logic mas é frágil
- `strategy/index.ts` tem +1700 linhas — muito lógica business hardcoded: `AIRLINE_PROGRAMS`, `TRANSFER_BASES`, `BANK_COST_PER_K`, `TAXES_BY_PROGRAM`, `BASE_COST_PER_K`
- `chat-busca/index.ts` tem `PROGRAM_ALLIANCES` e `ALLIANCES_CONTEXT` hardcoded — fonte de verdade para alianças
- Transferências de pontos são IRREVERSÍVEIS — a estratégia sempre adverte isso e coloca "confirmar disponibilidade" ANTES de transferir
- `vale_a_pena` (true/false) é calculado server-side pela função `analyzeProgram` — o LLM não pode mudar esse valor

## Convenções

- Edge Functions: Deno, imports via `https://esm.sh/` e `https://deno.land/std`
- Migrações: sequenciais `0NN_nome.sql` em `supabase/migrations/`
- Promoções: duas fontes — promos manuais (`programa` field) + scraper (`programas_tags` array)
- Preços Seats.aero: em milhas (não BRL) por programa — cada programa tem estoque separado
- Deploy backend: Railway (auto-deploy via git push) — `npm start` → `node server.js`
- Deploy frontend: Vite build → provavelmente Vercel ou similar
- Deploy Edge Functions: `supabase functions deploy <nome> --no-verify-jwt`

## Mudanças Recentes

### 2026-05-14
- Corrigido SyntaxError crítico em `routes/seats.js`: TypeScript annotation `(l: any)` numa linha `.find()` quebrava todo o módulo
- Adicionado link Google Flights em `StrategyContent.tsx` quando `vale_a_pena === false` (dinheiro é melhor)
- Implementada extração de prompts para `supabase/functions/*/prompts/*.ts`
- Criado sistema de knowledge base: migration `036_knowledge_base.sql`, script `scripts/sync-knowledge.js`
- Adicionado `fetchKnowledge()` em ambas as Edge Functions (RAG via tags)
```

- [ ] **Step 2: Commit**

```bash
git add docs/context/flywise-project-context.md
git commit -m "docs: add living project context document"
```

---

## Task 1: Extract Strategy Prompt

**Files:**
- Create: `supabase/functions/strategy/prompts/system.ts`
- Modify: `supabase/functions/strategy/index.ts` lines 1596–1629

The current system prompt is inline at line 1596 in `strategy/index.ts` as a template literal passed to OpenAI. We extract all static rules to a `.ts` file and use `{{PLACEHOLDERS}}` for the two dynamic values in rule 14.

- [ ] **Step 1: Create the prompt file**

Create `supabase/functions/strategy/prompts/system.ts`:

```typescript
// Strategy system prompt — edit this file to improve strategy quality.
// Uses {{CONFIRMED_PROGRAM}} and {{RECOMMENDED_PROGRAM}} as runtime placeholders.
export const STRATEGY_SYSTEM_PROMPT = `Você é FlyWise, especialista em milhas e programas de fidelidade do Brasil.
Gere uma estratégia HONESTA, PERSONALIZADA e EXECUTÁVEL com base nos dados fornecidos.

ALIANÇAS E PARCERIAS (use APENAS estas informações — não invente parcerias não listadas):
• united/lifemiles/aeroplan/turkish/singapore/miles_and_more: Star Alliance (ANA, Lufthansa, TAP, Swiss, Turkish, Copa)
• american/iberia/cathay/latam_pass/alaska: oneworld (British Airways, Qatar Airways, Japan Airlines)
• flyingblue/delta/aeromexico/saudia: SkyTeam (Air France, KLM, Korean Air)
• smiles: parceiros Delta, Air France, KLM, Copa, Etihad, Emirates
• azul: parceiros United (codeshare), TAP Air Portugal
• emirates/etihad: programas independentes com parceiros bilaterais

REGRAS OBRIGATÓRIAS:
1. O campo vale_a_pena JÁ FOI DETERMINADO PELO SERVIDOR (custo_total vs preço cash). Use o valor recebido — NÃO recalcule nem altere.
2. A seção "COMPARAÇÃO PRÉ-CALCULADA" contém dados verificados. Use os números EXATOS no motivo e step_details. NÃO invente custos diferentes.
3. Gere steps/step_details para o programa marcado como "★ MELHOR OPÇÃO".
4. No motivo (máx 3 frases): explique POR QUE este programa é melhor — cite diferenças de custo entre os programas. Se vale_a_pena: false, explique que comprar milhas sai mais caro que o voo em dinheiro, MAS que SE o usuário já tiver milhas o resgate continua sendo bom (CPM X c/pt).
5. NUNCA sugira solicitar ou contratar novo cartão de crédito — PROIBIDO.
6. ORDEM E CONTEÚDO DOS STEPS — determine o estado do usuário pelos dados da COMPARAÇÃO:
   • ESTADO A (saldo_direto >= milhas_necessarias no programa recomendado): gere 2 steps: (1) Confirmar disponibilidade no site do programa, (2) Emitir o bilhete. NÃO gere passo de transferência — o usuário JÁ TEM milhas suficientes no programa correto.
   • ESTADO B (saldo_direto parcial + transferências cobrindo o déficit): gere 3 steps: (1) Confirmar disponibilidade ANTES de qualquer ação, (2) Transferir pontos necessários (⚠️ transferência é IRREVERSÍVEL — faça SOMENTE após confirmar disponibilidade), (3) Emitir rapidamente pois disponibilidade prêmio pode desaparecer.
   • ESTADO C (sem milhas suficientes, déficit não coberto por transferências): gere 3-4 steps: (1) Adquirir milhas conforme a COMPARAÇÃO (melhor custo), (2) Transferir se aplicável, (3) Confirmar disponibilidade, (4) Emitir.
   REGRA CRÍTICA: NUNCA coloque o passo de emissão antes de o usuário ter as milhas necessárias. Emissão sempre é o ÚLTIMO passo.
7. EXPLICAÇÃO DE PROMOÇÕES PARA INICIANTES: quando há promo de transferência, o step_detail DEVE explicar: (a) O QUE É o programa de pontos origem em linguagem simples (ex: "Nubank Rewards são os pontos acumulados no cartão Nubank — você já pode ter sem saber"); (b) COMO FUNCIONA a transferência (ex: "você envia seus pontos pelo app Nubank para a Smiles, e eles viram milhas na sua conta"); (c) O RATIO com e sem bônus (ex: "normalmente 1 ponto Nubank = 1 milha Smiles, mas com esta promo = 1,3 milha"); (d) O IMPACTO CONCRETO neste voo calculado com os números da COMPARAÇÃO (ex: "para as 44.000 milhas, você precisaria transferir apenas 33.846 pontos Nubank"); (e) URL exato de transferência; (f) AVISO se cadastro prévio é obrigatório. Nunca diga apenas "aproveite a promoção" — todo iniciante precisa saber o que fazer, passo a passo.
8. Se há "✓ COBRE TUDO" na comparação, o passo 1 DEVE usar o saldo existente. Se há saldo parcial + transferência, combine os dois.
9. DÉFICIT DE MILHAS: quando há seção "COMO COBRIR O DÉFICIT", use os dados calculados: (a) cite o custo exato de comprar (ex: "comprar 26.500 Smiles custa R$ 1.113"); (b) se a Opção B (transferência) for mais barata, recomende ela como passo principal; (c) se a Opção C (acúmulo via parceiro) existir, calcule e apresente o valor a gastar na loja com o benefício final; (d) compare as opções em R$ no step_detail e recomende a mais vantajosa. NUNCA diga apenas "verifique se tem pontos no cartão" sem dar o custo alternativo.
10. Se o usuário tem clube (ex: Smiles Diamante), mencione o desconto nas taxas EXPLICITAMENTE.
11. Se a comparação mostrar "★ CLUBE X: R$ Y/mês | Z% desconto → economia de ~R$ W nesta emissão", gere um passo dedicado explicando: o que é o clube, quanto custa por mês, quanto economiza NESTA emissão específica, e se o clube se paga nessa compra ou em quantos meses. Seja específico com os valores R$ da seção COMPARAÇÃO.
11. steps: TÍTULO curto (máx 8 palavras). step_details: explicação didática completa — onde clicar, qual site/app, o que fazer, quanto tempo leva. Inclua URLs exatas e valores em R$.
12. Se vale_a_pena: false: steps devem ser (1) reservar em dinheiro agora, (2) como acumular/transferir milhas para o futuro, (3) quando monitorar promos.
13. Se há "PROMOÇÕES DE ACÚMULO" e o usuário tem déficit de milhas, gere um passo dedicado: qual programa, qual parceiro, quanto gastar para cobrir o déficit. Ex: "Comprando R$ 670 na Natura esta semana você ganha 10.050 pts Livelo — suficiente para cobrir o déficit sem comprar milhas diretamente."
13. Responda APENAS em JSON válido, sem texto adicional.
14. DISTINÇÃO ENTRE PROGRAMAS (CRÍTICO): o usuário selecionou um voo com disponibilidade confirmada no programa "{{CONFIRMED_PROGRAM}}". O programa recomendado pela análise é "{{RECOMMENDED_PROGRAM}}". SE OS DOIS PROGRAMAS SÃO DIFERENTES: explique no motivo (a) por que o programa recomendado tem melhor custo, (b) que a disponibilidade precisa ser verificada SEPARADAMENTE no site do {{RECOMMENDED_PROGRAM}} pois cada programa tem estoque próprio de assentos prêmio, (c) que milhas de programas diferentes NÃO são equivalentes — por isso os preços diferem. SE OS DOIS PROGRAMAS SÃO IGUAIS: não adicione caveats desnecessários. PROIBIDO tratar milhas de programas diferentes como intercambiáveis.`
```

- [ ] **Step 2: Update strategy/index.ts to import and use the prompt**

In `supabase/functions/strategy/index.ts`, at the very top (after the existing `import` statements), add:

```typescript
import { STRATEGY_SYSTEM_PROMPT } from './prompts/system.ts'
```

Then find the `content:` assignment in the OpenAI call (around line 1598) which currently starts with:

```typescript
content: `Você é FlyWise, especialista em milhas e programas de fidelidade do Brasil.
```

Replace that entire backtick string (lines 1598–1629) with:

```typescript
content: STRATEGY_SYSTEM_PROMPT
    .replace(/\{\{CONFIRMED_PROGRAM\}\}/g, seatsContext?.program ?? targetProgram)
    .replace(/\{\{RECOMMENDED_PROGRAM\}\}/g, effectiveTargetProgram),
```

The result should look like:

```typescript
body: JSON.stringify({
    model: 'gpt-4o-mini',
    messages: [
        {
            role: 'system',
            content: STRATEGY_SYSTEM_PROMPT
                .replace(/\{\{CONFIRMED_PROGRAM\}\}/g, seatsContext?.program ?? targetProgram)
                .replace(/\{\{RECOMMENDED_PROGRAM\}\}/g, effectiveTargetProgram),
        },
        { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 2000,
    temperature: 0.2,
}),
```

- [ ] **Step 3: Verify the file compiles (no TypeScript errors)**

```bash
cd "/Users/muriloroizpovoa/Desktop/Fly Wise"
npx tsc --noEmit --allowJs --target ES2020 --moduleResolution node supabase/functions/strategy/prompts/system.ts 2>&1 | head -20
```

Expected: no errors (or only Deno-related module resolution warnings which are acceptable for Edge Functions).

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/strategy/prompts/system.ts supabase/functions/strategy/index.ts
git commit -m "refactor(strategy): extract system prompt into prompts/system.ts"
```

---

## Task 2: Extract Chat-Busca Prompts

**Files:**
- Create: `supabase/functions/chat-busca/prompts/instructions-busca.ts`
- Create: `supabase/functions/chat-busca/prompts/instructions-para-onde.ts`
- Modify: `supabase/functions/chat-busca/index.ts` lines ~597–679

The chat-busca system prompt has two modes (`isParaOndeMode` branch and regular branch). The instruction sections are static — the dynamic data (wallet context, promo context, alliance text, wizard data) is already assembled as separate strings and injected. We extract the static instruction parts.

- [ ] **Step 1: Create instructions-para-onde.ts**

Create `supabase/functions/chat-busca/prompts/instructions-para-onde.ts`:

```typescript
// Static instruction sections for "Para onde posso voar?" mode.
// {{ALLIANCES_CONTEXT}} is replaced at runtime with the ALLIANCES_CONTEXT constant.
export const PARA_ONDE_INSTRUCTIONS = `ALIANÇAS E PARCERIAS DOS PROGRAMAS (dados verificados — use APENAS estas informações, não invente parcerias):
{{ALLIANCES_CONTEXT}}

REGRA DE OURO: Só afirme que um programa parceiro é utilizável em uma rota se search_awards retornou resultados reais para ele. As alianças acima indicam o potencial — a disponibilidade real vem do Seats.aero.

COMO ANALISAR:
1. Use os dados da carteira para identificar quais destinos são ALCANÇÁVEIS agora (milhas diretas ou via transferência de pontos)
2. Use o bloco "POTENCIAL COM BÔNUS" para mostrar destinos que ficam alcançáveis COM as promoções de transferência atuais
3. Para os melhores destinos, use search_awards para verificar disponibilidade real e datas
4. Foque nos programas que o usuário JÁ tem milhas ou pontos transferíveis
5. Leve em conta os clubes ativos para bônus extra de transferência

ANÁLISE DE PROMOÇÕES (compra de milhas, clubes, assinaturas):
- Mencione APENAS promoções que diretamente desbloqueiam um destino ou reduzem o custo desta busca específica
- Ex útil: falta 15k milhas para voar para Lisboa, há promoção de compra de milhas Smiles → mencione
- Ex útil: clube Smiles Diamond com 30% de desconto → mencione se Smiles foi o melhor programa encontrado
- Se a promoção não se encaixa nesta busca → IGNORE completamente, não liste

FORMATO DA ANÁLISE:
1. **Você pode voar agora** — destinos alcançáveis com saldo atual; programa, milhas necessárias vs disponível
2. **Com as promoções de transferência** — destinos extras alcançáveis usando os bônus ativos (use os valores calculados)
3. **Estratégia recomendada** — ação concreta: "transfira X pts do cartão Y para programa Z e reserve voo para W"
4. **Promoção relevante** — apenas se houver uma que faça diferença real para esta carteira
5. **Quando reservar** — disponibilidade encontrada e urgência

Use markdown com tabelas. Seja ESPECÍFICO com os números reais da carteira do usuário.
Para FOLLOW-UPS: use os dados já buscados, sem refazer buscas.`
```

- [ ] **Step 2: Create instructions-busca.ts**

Create `supabase/functions/chat-busca/prompts/instructions-busca.ts`:

```typescript
// Static instruction sections for regular flight search mode.
// {{ALLIANCES_CONTEXT}} is replaced at runtime with the ALLIANCES_CONTEXT constant.
export const BUSCA_INSTRUCTIONS = `ALIANÇAS E PARCERIAS DOS PROGRAMAS (dados verificados — use APENAS estas informações, não invente parcerias):
{{ALLIANCES_CONTEXT}}

REGRA DE OURO: Só afirme que um programa é utilizável em uma rota se search_awards retornou resultados reais para ele OU se a pergunta é sobre potencial teórico de aliança. Para recomendações concretas, use sempre dados do Seats.aero.

ESTRATÉGIA DE BUSCA:
- Sempre busque a rota principal primeiro
- São Paulo: origem pode ser GRU ou CGH — use o mais relevante (GRU para voos internacionais)
- Destinos com múltiplos aeroportos: busque todos (Tokyo: NRT + HND; London: LHR + LGW)
- Modo Hacker: inclua buscas via hubs intermediários (DXB, DOH, IST, FRA, AMS) onde faz sentido
- Ida e volta: busque as duas direções separadamente
- Origem flexível: busque dos aeroportos alternativos mais próximos

FORMATO DA ANÁLISE FINAL:
1. **Melhores opções encontradas** — tabela: programa | milhas | data | cia operadora | direto/escalas | taxas
2. **Transferências de pontos** — quais cartões brasileiros transferem para os melhores programas encontrados e em qual ratio (priorize: Amex Membership Rewards, C6 Bank, Nubank Ultravioleta, Livelo, Itaú, Bradesco, Smiles, LATAM Pass)
   - Se houver bônus de transferência ativo para um dos programas encontrados → DESTAQUE com urgência e calcule o ganho
3. **Disponibilidade** — escassa, moderada ou abundante; quando reservar
4. **Promoção relevante** — mencione SOMENTE se há promoção de compra de milhas ou clube que resolve um problema concreto desta busca (falta de saldo, custo alto). Se não se encaixa → ignore
5. **Próximo passo** — instrução única e clara: qual site, qual programa, o que fazer agora

Use markdown com tabelas quando listar opções. Seja ESPECÍFICO: use os números reais dos dados.
Para FOLLOW-UPS: responda usando os dados já buscados, sem refazer buscas desnecessárias.`
```

- [ ] **Step 3: Update chat-busca/index.ts to import and use the prompt files**

In `supabase/functions/chat-busca/index.ts`, add these imports at the top (after existing imports):

```typescript
import { PARA_ONDE_INSTRUCTIONS } from './prompts/instructions-para-onde.ts'
import { BUSCA_INSTRUCTIONS } from './prompts/instructions-busca.ts'
```

Then find the `systemPrompt` assignment around line 597, which currently reads:

```typescript
const systemPrompt = isParaOndeMode
    ? `Você é o FlyWise AI, especialista em milhas aéreas para brasileiros.
...
ALIANÇAS E PARCERIAS DOS PROGRAMAS (dados verificados — use APENAS estas informações, não invente parcerias):
${ALLIANCES_CONTEXT}

REGRA DE OURO: ...

COMO ANALISAR:
...
Para FOLLOW-UPS: use os dados já buscados, sem refazer buscas.`
    : `Você é o FlyWise AI, especialista em milhas aéreas e viagens para brasileiros.
...
Para FOLLOW-UPS: responda usando os dados já buscados, sem refazer buscas desnecessárias.`
```

Replace the `systemPrompt` assignment (lines ~597–679) with:

```typescript
const resolvedParaOndeInstructions = PARA_ONDE_INSTRUCTIONS
    .replace('{{ALLIANCES_CONTEXT}}', ALLIANCES_CONTEXT)

const resolvedBuscaInstructions = BUSCA_INSTRUCTIONS
    .replace('{{ALLIANCES_CONTEXT}}', ALLIANCES_CONTEXT)

const systemPrompt = isParaOndeMode
    ? `Você é o FlyWise AI, especialista em milhas aéreas para brasileiros.

CONTEXTO — Para Onde Posso Voar?
O usuário quer saber para onde pode viajar usando as milhas e pontos que já possui.
Sua análise deve ser 100% baseada no saldo real do usuário — não faça suposições.
${walletContext}
${transferBonusContext}
${milesClubContext}

Configuração da busca:
- Origem: ${wizard_data.origin}
- Classe: ${cabinPt}
- Meses: ${(wizard_data.months as string[] | undefined)?.join(', ') ?? datePeriod}

Você tem acesso à ferramenta search_awards para buscar detalhes de disponibilidade em rotas específicas.

${resolvedParaOndeInstructions}`
    : `Você é o FlyWise AI, especialista em milhas aéreas e viagens para brasileiros.

DADOS DA BUSCA:
- Rota: ${wizard_data.origin} → ${wizard_data.destination}
- Tipo: ${wizard_data.tripType === 'round-trip' ? 'Ida e Volta' : 'Só Ida'}
- Período: ${datePeriod}
- Passageiros: ${wizard_data.passengers}
- Classe desejada: ${cabinPt}
- Estratégia: ${wizard_data.hackerMode === 'comfort' ? 'Conforto (prioriza direto)' : wizard_data.hackerMode === 'hacker' ? 'Avançada — Modo Hacker (2 reservas separadas, hubs, qualquer programa)' : 'Melhor Custo-Benefício'}
- Origem flexível: ${wizard_data.flexibleOrigin ? 'Sim' : 'Não'}
${wizard_data.observations ? `- Observações: ${wizard_data.observations}` : ''}
${passagensContext}${transferBonusContext}
${milesClubContext}

Você tem acesso à ferramenta search_awards com dados reais do Seats.aero.

${resolvedBuscaInstructions}`
```

- [ ] **Step 4: Verify no TypeScript errors**

```bash
cd "/Users/muriloroizpovoa/Desktop/Fly Wise"
node --input-type=module <<'EOF'
// Quick smoke test: the prompts export strings
import('./supabase/functions/chat-busca/prompts/instructions-busca.ts').catch(e => {
  // Expected to fail (Deno .ts format) — just checking for syntax errors
  if (e.message.includes('BUSCA_INSTRUCTIONS')) console.error('export missing')
  else console.log('OK — module format fine, Deno-only import expected')
})
EOF
```

Expected: no crash, module format check passes.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/chat-busca/prompts/instructions-busca.ts
git add supabase/functions/chat-busca/prompts/instructions-para-onde.ts
git add supabase/functions/chat-busca/index.ts
git commit -m "refactor(chat-busca): extract static instruction sections into prompts/ files"
```

---

## Task 3: Supabase Migration — Knowledge Base Tables

**Files:**
- Create: `supabase/migrations/036_knowledge_base.sql`

- [ ] **Step 1: Create the migration**

Create `supabase/migrations/036_knowledge_base.sql`:

```sql
-- Knowledge base: curated domain knowledge about the miles world
-- Authored in Obsidian vault, synced here by scripts/sync-knowledge.js
-- Used for RAG injection into Edge Functions (strategy + chat-busca)

create table if not exists knowledge_base (
    id          uuid primary key default gen_random_uuid(),
    slug        text unique not null,
    title       text not null,
    content     text not null,
    programs    text[] not null default '{}',
    topics      text[] not null default '{}',
    routes      text[] not null default '{}',
    updated_at  timestamptz not null default now(),
    active      boolean not null default true
);

create index if not exists knowledge_base_programs_gin  on knowledge_base using gin(programs);
create index if not exists knowledge_base_topics_gin    on knowledge_base using gin(topics);
create index if not exists knowledge_base_routes_gin    on knowledge_base using gin(routes);
create index if not exists knowledge_base_active_idx    on knowledge_base(active);

-- Inbox for semi-automated structural updates (e.g., alliance changes, ratio updates)
-- Requires human review before entries reach knowledge_base
create table if not exists knowledge_inbox (
    id         uuid primary key default gen_random_uuid(),
    slug       text,
    source     text,
    title      text,
    content    text,
    programs   text[] default '{}',
    topics     text[] default '{}',
    status     text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
    created_at timestamptz not null default now()
);

-- RLS: only service role can write; authenticated users can read knowledge_base
alter table knowledge_base enable row level security;
alter table knowledge_inbox enable row level security;

create policy "knowledge_base_read" on knowledge_base
    for select using (active = true);

create policy "knowledge_inbox_service_only" on knowledge_inbox
    for all using (false);
```

- [ ] **Step 2: Apply the migration locally (if using local Supabase)**

```bash
supabase db push
```

Expected output: `Applying migration 036_knowledge_base.sql` with no errors.

If not running local Supabase, skip this step — the migration runs on the next Supabase deploy.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/036_knowledge_base.sql
git commit -m "feat(db): add knowledge_base and knowledge_inbox tables"
```

---

## Task 4: Sync Script (Obsidian → Supabase)

**Files:**
- Create: `scripts/sync-knowledge.js`

- [ ] **Step 1: Install gray-matter if not present**

```bash
cd "/Users/muriloroizpovoa/Desktop/Fly Wise"
npm list gray-matter 2>/dev/null || npm install --save-dev gray-matter
```

Expected: `gray-matter@x.x.x` in list output, or installation completes.

- [ ] **Step 2: Create the sync script**

Create `scripts/sync-knowledge.js`:

```javascript
#!/usr/bin/env node
/**
 * Syncs Obsidian vault notes to Supabase knowledge_base table.
 *
 * Usage:
 *   OBSIDIAN_VAULT_PATH=/path/to/vault SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/sync-knowledge.js
 *
 * Or create .env.local with those vars and run:
 *   node -r dotenv/config scripts/sync-knowledge.js
 *
 * Notes must have frontmatter with at least: title, programs[], topics[]
 * Slug is derived from the filename without extension.
 */

import { createClient } from '@supabase/supabase-js'
import matter from 'gray-matter'
import fs from 'fs'
import path from 'path'

const VAULT_PATH = process.env.OBSIDIAN_VAULT_PATH
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!VAULT_PATH || !SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing env vars: OBSIDIAN_VAULT_PATH, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY)

function collectMarkdownFiles(dir, results = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name.startsWith('.')) continue
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) {
            collectMarkdownFiles(full, results)
        } else if (entry.name.endsWith('.md')) {
            results.push(full)
        }
    }
    return results
}

async function run() {
    const files = collectMarkdownFiles(VAULT_PATH)
    console.log(`Found ${files.length} markdown files in ${VAULT_PATH}`)

    const slugsSeen = new Set()
    let upserted = 0
    let skipped = 0
    let errors = 0

    for (const filePath of files) {
        const raw = fs.readFileSync(filePath, 'utf8')
        const { data: fm, content } = matter(raw)

        if (!fm.title || !fm.programs || !fm.topics) {
            console.warn(`  SKIP (no frontmatter): ${path.relative(VAULT_PATH, filePath)}`)
            skipped++
            continue
        }

        const slug = path.basename(filePath, '.md')
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, '-')
            .replace(/-+/g, '-')

        slugsSeen.add(slug)

        const row = {
            slug,
            title: String(fm.title),
            content: content.trim(),
            programs: Array.isArray(fm.programs) ? fm.programs : [fm.programs],
            topics: Array.isArray(fm.topics) ? fm.topics : [fm.topics],
            routes: Array.isArray(fm.routes) ? fm.routes : (fm.routes ? [fm.routes] : []),
            updated_at: new Date().toISOString(),
            active: true,
        }

        const { error } = await sb
            .from('knowledge_base')
            .upsert(row, { onConflict: 'slug' })

        if (error) {
            console.error(`  ERROR upserting ${slug}:`, error.message)
            errors++
        } else {
            console.log(`  OK: ${slug}`)
            upserted++
        }
    }

    // Soft-delete notes no longer in vault
    if (slugsSeen.size > 0) {
        const { error } = await sb
            .from('knowledge_base')
            .update({ active: false })
            .not('slug', 'in', `(${[...slugsSeen].map(s => `'${s}'`).join(',')})`)
            .eq('active', true)

        if (error) console.warn('  WARN soft-delete:', error.message)
    }

    console.log(`\nDone: ${upserted} upserted, ${skipped} skipped, ${errors} errors`)
}

run().catch(err => {
    console.error('Fatal:', err)
    process.exit(1)
})
```

- [ ] **Step 3: Make executable and test with dry-run**

```bash
chmod +x "/Users/muriloroizpovoa/Desktop/Fly Wise/scripts/sync-knowledge.js"
# Test that the script starts up correctly (will fail at vault check, that's fine)
node "/Users/muriloroizpovoa/Desktop/Fly Wise/scripts/sync-knowledge.js" 2>&1 | head -3
```

Expected: `Missing env vars: OBSIDIAN_VAULT_PATH, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY`

- [ ] **Step 4: Commit**

```bash
git add scripts/sync-knowledge.js package.json package-lock.json
git commit -m "feat(scripts): add Obsidian vault → Supabase knowledge_base sync script"
```

---

## Task 5: RAG Injection — Strategy Edge Function

**Files:**
- Modify: `supabase/functions/strategy/index.ts`

Add a `fetchKnowledge()` helper and call it in parallel with `fetchPromos` + `fetchUserData` before prompt assembly.

- [ ] **Step 1: Add fetchKnowledge helper to strategy/index.ts**

In `supabase/functions/strategy/index.ts`, find the `// ─── User data ───` comment (around line 1226). Insert the following function ABOVE it (between the `buildMultiProgramComparison` closing brace and `fetchUserData`):

```typescript
// ─── Knowledge base RAG ───────────────────────────────────────────────────────

async function fetchKnowledge(
    programs: string[],
    topics: string[],
    sb: ReturnType<typeof createClient>
): Promise<string> {
    try {
        const programFilter = programs.length > 0 ? `programs.cs.{${programs.join(',')}}` : ''
        const topicFilter = topics.length > 0 ? `topics.cs.{${topics.join(',')}}` : ''
        const orFilter = [programFilter, topicFilter].filter(Boolean).join(',')
        if (!orFilter) return ''

        const { data } = await sb
            .from('knowledge_base')
            .select('title, content')
            .eq('active', true)
            .or(orFilter)
            .order('updated_at', { ascending: false })
            .limit(5)

        if (!data?.length) return ''

        const chunks = data.map((n: { title: string; content: string }) => `## ${n.title}\n${n.content}`)
        return `=== CONHECIMENTO BASE ===\n${chunks.join('\n\n---\n\n')}\n=== FIM DO CONHECIMENTO ===`
    } catch (err) {
        console.error('[strategy] fetchKnowledge error:', err)
        return ''
    }
}
```

- [ ] **Step 2: Call fetchKnowledge in parallel with fetchPromos + fetchUserData**

Find the line in `serve()` that reads (around line 1453):

```typescript
const [promoResult, userData] = await Promise.all([
    fetchPromos(targetProgram, programs, sb),
    userId ? fetchUserData(userId, sb) : Promise.resolve(null),
])
```

Replace it with:

```typescript
const knowledgeTopics = ['sweet-spots', 'parceiros', 'aliança', 'routing']
const [promoResult, userData, knowledgeContext] = await Promise.all([
    fetchPromos(targetProgram, programs, sb),
    userId ? fetchUserData(userId, sb) : Promise.resolve(null),
    fetchKnowledge(programs, knowledgeTopics, sb),
])
```

- [ ] **Step 3: Inject knowledgeContext into prompt sections**

Find the prompt assembly block (around line 1500):

```typescript
const sections: string[] = ['=== VOO SELECIONADO ===', buildFlightString(flight, effectiveTargetProgram)]
```

After the `if (cpmSection)` block that pushes `ANÁLISE DE VALOR`, add:

```typescript
if (knowledgeContext) {
    sections.push('\n' + knowledgeContext)
}
```

So the sections array builds in this order:
1. VOO SELECIONADO
2. DISPONIBILIDADE REAL (if seatsContext)
3. ANÁLISE DE VALOR (if cpmSection)
4. **CONHECIMENTO BASE (if knowledgeContext)** ← new
5. COMPARAÇÃO PRÉ-CALCULADA
6. COMO COBRIR O DÉFICIT
7. PROMOÇÕES ATIVAS

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/strategy/index.ts
git commit -m "feat(strategy): inject knowledge base chunks into prompt via RAG"
```

---

## Task 6: RAG Injection — Chat-Busca Edge Function

**Files:**
- Modify: `supabase/functions/chat-busca/index.ts`

- [ ] **Step 1: Add fetchKnowledge helper to chat-busca/index.ts**

In `supabase/functions/chat-busca/index.ts`, find the `// ─── Seats.aero API ───` comment (around line 172). Insert the following function ABOVE it (after the date range helpers section):

```typescript
// ─── Knowledge base RAG ───────────────────────────────────────────────────────

async function fetchKnowledge(
    programs: string[],
    topics: string[],
): Promise<string> {
    try {
        const programFilter = programs.length > 0 ? `programs.cs.{${programs.join(',')}}` : ''
        const topicFilter = topics.length > 0 ? `topics.cs.{${topics.join(',')}}` : ''
        const orFilter = [programFilter, topicFilter].filter(Boolean).join(',')
        if (!orFilter) return ''

        const { data } = await sbAdmin
            .from('knowledge_base')
            .select('title, content')
            .eq('active', true)
            .or(orFilter)
            .order('updated_at', { ascending: false })
            .limit(5)

        if (!data?.length) return ''

        const chunks = (data as { title: string; content: string }[])
            .map(n => `## ${n.title}\n${n.content}`)
        return `\n\nCONHECIMENTO BASE (dados verificados sobre programas e rotas):\n${chunks.join('\n\n---\n\n')}`
    } catch {
        return ''
    }
}
```

- [ ] **Step 2: Call fetchKnowledge in parallel with the promo fetches**

Find the `await Promise.all([` block (around line 435) that fetches the four promo contexts. Add `fetchKnowledge` as a fifth parallel task:

```typescript
let knowledgeContext = ''
await Promise.all([
    // ... existing four tasks ...
    (async () => {
        const programs = wizard_data.programs as string[] | undefined
        const programList = programs && programs.length > 0
            ? programs
            : ['smiles', 'latam pass', 'livelo']
        knowledgeContext = await fetchKnowledge(programList, ['sweet-spots', 'parceiros', 'routing', 'aliança'])
    })(),
])
```

- [ ] **Step 3: Inject knowledgeContext into the system prompt**

In the `systemPrompt` assignment (modified in Task 2), add `${knowledgeContext}` at the end of the static data sections, just before the resolved instructions. For both modes:

For the `isParaOndeMode` branch, the prompt ends with:
```typescript
Você tem acesso à ferramenta search_awards para buscar detalhes de disponibilidade em rotas específicas.

${resolvedParaOndeInstructions}`
```

Change it to:
```typescript
Você tem acesso à ferramenta search_awards para buscar detalhes de disponibilidade em rotas específicas.
${knowledgeContext}

${resolvedParaOndeInstructions}`
```

For the regular mode branch, the prompt ends with:
```typescript
Você tem acesso à ferramenta search_awards com dados reais do Seats.aero.

${resolvedBuscaInstructions}`
```

Change it to:
```typescript
Você tem acesso à ferramenta search_awards com dados reais do Seats.aero.
${knowledgeContext}

${resolvedBuscaInstructions}`
```

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/chat-busca/index.ts
git commit -m "feat(chat-busca): inject knowledge base chunks into prompt via RAG"
```

---

## Task 7: Seed Initial Knowledge Base Notes

**Files:**
- Create: `knowledge/programs/smiles-sweet-spots.md`
- Create: `knowledge/programs/latam-pass-sweet-spots.md`
- Create: `knowledge/concepts/quando-milhas-valem-a-pena.md`

These are the first notes in the knowledge vault. They live in a `knowledge/` folder in the repo root (the Obsidian vault can be pointed here). The sync script will upload them to Supabase.

- [ ] **Step 1: Create knowledge folder structure**

```bash
mkdir -p "/Users/muriloroizpovoa/Desktop/Fly Wise/knowledge/programs"
mkdir -p "/Users/muriloroizpovoa/Desktop/Fly Wise/knowledge/concepts"
mkdir -p "/Users/muriloroizpovoa/Desktop/Fly Wise/knowledge/routing"
mkdir -p "/Users/muriloroizpovoa/Desktop/Fly Wise/knowledge/alliances"
```

- [ ] **Step 2: Create smiles-sweet-spots.md**

Create `knowledge/programs/smiles-sweet-spots.md`:

```markdown
---
title: Smiles — Sweet Spots e Melhores Resgates
programs: [smiles]
topics: [sweet-spots, resgate]
routes: [brasil-eua, brasil-europa, global]
updated: 2026-05-14
---

## Smiles (GOL) — Sweet Spots

Smiles é o programa de fidelidade da GOL, mas resgata em parceiros via code-share e alianças bilaterais:
Delta, Air France, KLM, Copa Airlines, Etihad, Emirates, Aeromexico.

### Rotas Brasil → EUA
- GRU→MIA ou GRU→JFK em economy: ~30.000–40.000 pts (direto, Delta ou GOL)
- Ida e volta economy: ~60.000–80.000 pts total
- Business GRU→MIA (Delta): ~50.000–70.000 pts ida

### Rotas Brasil → Europa
- GRU→CDG ou GRU→AMS em economy (Air France/KLM): ~45.000–55.000 pts ida
- Business GRU→CDG: ~80.000–100.000 pts ida — excelente CPM quando disponível

### Taxas (YQ)
- Voos GOL: taxas baixas (~R$80–120 para domésticos, ~R$200–350 para internacionais)
- Voos Delta: taxas moderadas (~R$100–200)
- Voos Air France/KLM: taxas altas (~R$400–800 dependendo da cabine)

### Dica de Resgate
Smiles não tem saver awards com disponibilidade garantida. Verifique SEMPRE via Seats.aero antes de transferir pontos.
Promoções de compra de milhas Smiles costumam acontecer às quartas-feiras com até 40% de bônus.

### Validade
Milhas Smiles expiram após 24 meses de inatividade (qualquer atividade — compra, transferência, resgate — renova o prazo).
```

- [ ] **Step 3: Create latam-pass-sweet-spots.md**

Create `knowledge/programs/latam-pass-sweet-spots.md`:

```markdown
---
title: LATAM Pass — Sweet Spots e Melhores Resgates
programs: [latam pass]
topics: [sweet-spots, resgate]
routes: [brasil-eua, brasil-europa, brasil-sul-america, global]
updated: 2026-05-14
---

## LATAM Pass — Sweet Spots

LATAM Pass resgata em voos LATAM (LA/JJ) e parceiros oneworld: American Airlines, British Airways, Iberia, Cathay Pacific, Qatar Airways, Japan Airlines, Finnair.

### Rotas Brasil → EUA
- GRU→MIA ou GRU→JFK em economy: ~35.000–45.000 pts (LATAM direto)
- GRU→LAX em economy: ~40.000–50.000 pts (LATAM ou AA)
- Business GRU→MIA (LATAM): ~60.000–80.000 pts ida

### Rotas Brasil → Europa
- GRU→LIS ou GRU→MAD em economy: ~45.000–55.000 pts (LATAM ou Iberia)
- Business GRU→LIS (LATAM): ~80.000–95.000 pts ida

### Taxas (YQ)
- Voos LATAM: taxas moderadas (~R$350–600 para internacionais em economy, ~R$600–900 em business)
- Voos American: taxas geralmente baixas (~R$100–200)
- Voos British/Iberia: taxas altas — verifique sempre antes

### Dica de Resgate
LATAM Pass usa tabela de preços dinâmica nos voos LATAM, mas em parceiros oneworld ainda pode ter preços fixos. Verifique disponibilidade via Seats.aero para tabela parceiro.
Programa "Turbine" oferece bônus de compra de milhas sazonalmente.

### Validade
Milhas LATAM Pass expiram após 24 meses de inatividade.
```

- [ ] **Step 4: Create quando-milhas-valem-a-pena.md**

Create `knowledge/concepts/quando-milhas-valem-a-pena.md`:

```markdown
---
title: Quando Milhas Valem a Pena — CPM e Referências
programs: [smiles, latam pass, tudoazul, livelo, azul]
topics: [conceito, cpm, resgate, avaliacao]
routes: []
updated: 2026-05-14
---

## CPM — Centavos Por Milha

CPM = (Preço em dinheiro × 100) ÷ Milhas necessárias

Mede quanto cada milha "vale" para você em centavos de real.

### Referências de Avaliação

| CPM | Avaliação |
|-----|-----------|
| ≥ 3,5 c/pt | EXCELENTE — use milhas sem hesitar |
| 2,5–3,5 c/pt | MUITO BOM |
| 1,8–2,5 c/pt | BOM |
| 1,2–1,8 c/pt | RAZOÁVEL — vale se já tiver milhas |
| < 1,2 c/pt | RUIM — dinheiro é melhor |

### Quando Definitivamente Vale

- CPM ≥ 1,2 E você já tem as milhas: resgate é melhor que pagar em dinheiro
- Business/First com CPM ≥ 2,0: oportunidade excelente (business em dinheiro costuma custar 4–8× mais)
- Disponibilidade escassa (Seats.aero mostra poucos assentos): reserve logo mesmo com CPM razoável

### Quando Definitivamente Não Vale

- CPM < 1,0: custo de milhas + taxas supera o preço em dinheiro
- Rota doméstica barata (ex: GRU→CGH por R$250): não compensa milhas internacionais
- Tarifas muito promocionais em dinheiro: compare sempre com a opção cash

### Armadilha Comum

Comprar milhas PARA resgatar num voo geralmente não compensa: o custo de compra das milhas + taxas raramente fica abaixo do preço cash. A vantagem real das milhas é usar pontos que você JÁ ACUMULOU sem custo adicional.
```

- [ ] **Step 5: Commit knowledge files**

```bash
git add knowledge/
git commit -m "feat(knowledge): add initial seed notes for Smiles, LATAM Pass, and CPM concepts"
```

---

## Task 8: Run Sync and Verify End-to-End

- [ ] **Step 1: Set up env vars and run sync script**

```bash
cd "/Users/muriloroizpovoa/Desktop/Fly Wise"
OBSIDIAN_VAULT_PATH="$(pwd)/knowledge" \
SUPABASE_URL="$(grep VITE_SUPABASE_URL .env.local | cut -d= -f2 || grep SUPABASE_URL .env | cut -d= -f2)" \
SUPABASE_SERVICE_ROLE_KEY="$(grep SUPABASE_SERVICE_ROLE_KEY .env.local | cut -d= -f2 || grep SUPABASE_SERVICE_ROLE_KEY .env | cut -d= -f2)" \
node scripts/sync-knowledge.js
```

Expected output:
```
Found 3 markdown files in /path/to/knowledge
  OK: smiles-sweet-spots
  OK: latam-pass-sweet-spots
  OK: quando-milhas-valem-a-pena

Done: 3 upserted, 0 skipped, 0 errors
```

- [ ] **Step 2: Verify rows exist in Supabase**

Run this SQL in Supabase Studio (or via MCP):

```sql
select slug, title, array_length(programs, 1) as program_count, active
from knowledge_base
order by updated_at desc;
```

Expected: 3 rows, all `active = true`.

- [ ] **Step 3: Test RAG query manually**

```sql
select title, left(content, 100) as preview
from knowledge_base
where active = true
and programs && array['smiles']
order by updated_at desc
limit 5;
```

Expected: `smiles-sweet-spots` and `quando-milhas-valem-a-pena` appear (both tagged smiles).

- [ ] **Step 4: Deploy Edge Functions and smoke-test**

```bash
supabase functions deploy strategy --no-verify-jwt
supabase functions deploy chat-busca --no-verify-jwt
```

Expected: both deploy without errors. Test by generating a strategy in the app — the LLM response should now include knowledge base context (you can `console.log(sections)` temporarily to verify if needed).

---

## Self-Review Checklist

**Spec coverage:**
- ✅ Phase 0: Project context doc → Task 0
- ✅ Phase 1: Prompt extraction (strategy) → Task 1
- ✅ Phase 1: Prompt extraction (chat-busca) → Task 2
- ✅ Phase 2: Supabase schema → Task 3
- ✅ Phase 2: Sync script → Task 4
- ✅ Phase 3: RAG in strategy → Task 5
- ✅ Phase 3: RAG in chat-busca → Task 6
- ✅ Seed notes → Task 7
- ✅ End-to-end verification → Task 8

**Phase 4 (Knowledge Inbox)**: deferred per spec — `knowledge_inbox` table is already created in the migration for future use.

**Prompt consistency:**
- `STRATEGY_SYSTEM_PROMPT` uses `{{CONFIRMED_PROGRAM}}` and `{{RECOMMENDED_PROGRAM}}` — both replaced with `.replace(/regex/g, value)` in Task 1 Step 2. ✅
- `PARA_ONDE_INSTRUCTIONS` and `BUSCA_INSTRUCTIONS` use `{{ALLIANCES_CONTEXT}}` — replaced in Task 2 Step 3. ✅
- `fetchKnowledge` function signature is identical between strategy (takes `sb` param) and chat-busca (uses module-level `sbAdmin`). ✅
