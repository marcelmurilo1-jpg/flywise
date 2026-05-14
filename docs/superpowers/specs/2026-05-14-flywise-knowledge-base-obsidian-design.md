# FlyWise Knowledge Base + Prompt Management — Design Spec

**Date:** 2026-05-14  
**Status:** Approved

---

## Goal

Introduce a curated, team-maintained knowledge base (authored in Obsidian) that enriches LLM context with structural domain knowledge about the miles world — while keeping all dynamic data (promos, user points, flights, transfer ratios) in Supabase as-is. Separately, extract hardcoded LLM prompts from Edge Function source into standalone `.md` files for easier iteration.

---

## Scope

This spec covers two distinct improvements:

1. **Knowledge Base** — Obsidian vault → Supabase `knowledge_base` table → tag-based RAG injection into Edge Functions
2. **Prompt Extraction** — move the system/instruction sections of both Edge Function prompts into versioned `.md` files in the repo

Dynamic data pipelines (promos, transfer bonuses, clubs, user points, Seats.aero availability) are **out of scope** — they remain exactly as today.

---

## Architecture

```
Obsidian Vault (team edits)
    ↓ sync script / MCP upload
Supabase: knowledge_base table
    ↓ tag-based query at request time
Edge Function: strategy / chat-busca
    ↓ inject as context block
Claude / LLM
```

```
Git Repo: supabase/functions/strategy/prompts/*.md
    ↓ read at deploy / imported as string
Edge Function assembles: system prompt + knowledge chunks + dynamic data
    ↓
Claude / LLM
```

---

## Part 1 — Knowledge Base

### What Goes In

Structural, timeless domain knowledge authored and maintained by the FlyWise team:

- Program rules (sweet spots, routing rules, partner airlines, expiration policies)
- Alliance maps and transfer partnerships (what transfers to what, in which direction)
- Route-specific tips (Brazil→USA, Brazil→Europe, within South America)
- Redemption strategies (stopover tricks, positioning flights, mixed-cabin)
- Glossary and concepts (CPM reference ranges, what counts as a good redemption)

**NOT in the knowledge base:**
- Current promo prices (→ `vw_promocoes_ativas`)
- Transfer ratios with time limits (→ `promos` tables)
- User point balances (→ Supabase user data)
- Real-time flight availability (→ Seats.aero API)

### Obsidian Vault Structure

```
flywise-knowledge/
  programs/
    smiles-sweet-spots.md
    smiles-parceiros-transferencia.md
    latam-pass-sweet-spots.md
    latam-pass-parceiros.md
    tudoazul-sweet-spots.md
    livelo-sweet-spots.md
    livelo-parceiros-transferencia.md
    azul-sweet-spots.md
    tap-miles-go.md
    american-aadvantage.md
    united-mileageplus.md
  routing/
    brasil-eua.md
    brasil-europa.md
    brasil-sul-america.md
    conexoes-hub-estrategias.md
  concepts/
    o-que-e-cpm.md
    quando-milhas-valem-a-pena.md
    classes-de-servico.md
    stopover-open-jaw.md
  alliances/
    star-alliance-parceiros.md
    oneworld-parceiros.md
    skyteam-parceiros.md
```

### Note Frontmatter (mandatory)

Each `.md` file must have:

```yaml
---
title: Smiles — Sweet Spots e Melhores Resgates
programs: [smiles]
topics: [sweet-spots, resgate]
routes: [brasil-eua, brasil-europa]
updated: 2026-05-14
---
```

- `programs`: which loyalty programs this note applies to (used as primary retrieval key)
- `topics`: what kind of knowledge (`sweet-spots`, `parceiros`, `routing`, `conceito`, `aliança`, `transferencia`)
- `routes`: optional route tags (`brasil-eua`, `brasil-europa`, `brasil-sul-america`, `global`)

### Supabase Schema

```sql
create table knowledge_base (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,          -- e.g. 'smiles-sweet-spots'
  title       text not null,
  content     text not null,                 -- full markdown body
  programs    text[] not null default '{}',
  topics      text[] not null default '{}',
  routes      text[] not null default '{}',
  updated_at  timestamptz not null default now(),
  active      boolean not null default true
);

create index on knowledge_base using gin(programs);
create index on knowledge_base using gin(topics);
create index on knowledge_base using gin(routes);
```

**Optional — review inbox for semi-automated updates:**

```sql
create table knowledge_inbox (
  id         uuid primary key default gen_random_uuid(),
  slug       text,
  source     text,         -- e.g. 'news-scraper', 'manual'
  title      text,
  content    text,
  status     text default 'pending',   -- pending | approved | rejected
  created_at timestamptz default now()
);
```

### Sync Script

A Node.js script (`scripts/sync-knowledge.js`) that:

1. Reads all `.md` files from the local Obsidian vault path (configurable via `OBSIDIAN_VAULT_PATH` env var)
2. Parses frontmatter with `gray-matter`
3. Upserts into `knowledge_base` by `slug` (derived from filename without `.md`)
4. Marks notes not found in vault as `active = false` (soft delete)

Run manually or as a pre-deploy step. Does not run automatically — team controls when knowledge is published.

### RAG Retrieval Logic

At request time in each Edge Function:

```typescript
async function fetchKnowledge(programs: string[], topics: string[], routes: string[]): Promise<string> {
  const { data } = await supabase
    .from('knowledge_base')
    .select('title, content')
    .eq('active', true)
    .or(`programs.cs.{${programs.join(',')}},topics.cs.{${topics.join(',')}},routes.cs.{${routes.join(',')}}`)
    .order('updated_at', { ascending: false })
    .limit(5);

  if (!data?.length) return '';

  return data.map(n => `## ${n.title}\n${n.content}`).join('\n\n---\n\n');
}
```

The context block is injected into the prompt between the system instruction and the dynamic data sections, with a header:

```
=== CONHECIMENTO BASE ===
[chunks here]
=== FIM DO CONHECIMENTO ===
```

Token budget: max 5 notes × ~300 tokens each = ~1500 tokens added per call. Acceptable.

### What Does NOT Change

- `buildPromoContext.ts` and promo injection pipeline — unchanged
- Transfer ratio math and `TRANSFER_BASES` — unchanged for now (can migrate later if desired)
- User points fetching — unchanged
- Seats.aero availability calls — unchanged
- `vw_promocoes_ativas` view — unchanged

---

## Part 2 — Prompt Extraction

### Current State

Both Edge Functions (`strategy` and `chat-busca`) have their system prompts embedded directly in TypeScript source. Iterating on prompts requires editing `.ts` files and deploying — no diff visibility, no version history isolated from code changes.

### New Structure

```
supabase/functions/
  strategy/
    prompts/
      system.md          ← who you are, your goal, tone
      reasoning.md       ← how to reason about CPM, when miles are worth it
      output-format.md   ← expected JSON structure
    index.ts             ← imports and assembles prompts
  chat-busca/
    prompts/
      system.md          ← search assistant persona and capabilities
      tools-guidance.md  ← how/when to use the search tool
    index.ts
```

Each `.md` file is plain text (no frontmatter needed). The Edge Function reads them:

```typescript
import systemPrompt from './prompts/system.md?raw';
import reasoningPrompt from './prompts/reasoning.md?raw';
import outputFormat from './prompts/output-format.md?raw';

const SYSTEM = [systemPrompt, reasoningPrompt, outputFormat].join('\n\n');
```

Or via `Deno.readTextFile` if `?raw` imports aren't supported in the Deno runtime:

```typescript
const systemPrompt = await Deno.readTextFile(new URL('./prompts/system.md', import.meta.url));
```

### Benefits

- Each prompt improvement is a standalone git commit with clean diff
- Can use `git log -- supabase/functions/strategy/prompts/system.md` to see prompt history
- Rollback is a `git revert`
- Obsidian can be used to **view and draft** prompt changes (the vault can include a `prompts/` folder that mirrors the repo files), but the **source of truth is the repo**, not Supabase

### What Does NOT Change

- How prompts are assembled with dynamic data — same logic, just reads from files instead of inline strings
- The dynamic sections (promo context, user points, flight data) stay in TypeScript
- No versioning table in Supabase — git is the version system for prompts

---

## Data Flow Summary

**Strategy call:**

```
Request (origem, destino, data, user_id)
    ↓
Parallel fetch:
  - User points (Supabase)
  - Active promos (vw_promocoes_ativas)
  - Seats.aero availability (cache or API)
  - Knowledge chunks (knowledge_base, by programs + topics)
    ↓
Assemble prompt:
  [system.md + reasoning.md + output-format.md]
  + PROMOÇÕES ATIVAS
  + SALDO DO USUÁRIO
  + CONHECIMENTO BASE (RAG chunks)
  + VOO SELECIONADO
    ↓
Claude → JSON response
```

**Chat busca avançada call:**

```
User message
    ↓
Fetch knowledge chunks relevant to detected programs/routes
    ↓
Assemble prompt:
  [system.md + tools-guidance.md]
  + CONHECIMENTO BASE (RAG chunks)
  + PROMOÇÕES ATIVAS
    ↓
Claude (with search tool) → response
```

---

## Part 3 — FlyWise Project Context Doc (Obsidian)

### Purpose

A living `context/flywise-project-context.md` file inside the Obsidian vault that describes the FlyWise project for developer/AI orientation. It is updated at the end of each Claude Code session to reflect new changes, so the next session starts with accurate context instead of re-discovering the codebase from scratch.

This is separate from the domain knowledge base — it documents **the project itself**, not the miles world.

### What It Contains

```markdown
# FlyWise — Project Context

## O que é o FlyWise
[1 paragraph: product description, target user, core value prop]

## Tech Stack
- Frontend: React + TypeScript + Vite + Tailwind
- Backend: Express (Node.js) on Railway
- Edge Functions: Supabase Deno (strategy, chat-busca, etc.)
- Database: Supabase (PostgreSQL)
- APIs: Seats.aero (award search), Google Flights scraper
- AI: Claude via Anthropic SDK

## Arquitetura — Mapa de Arquivos Chave
[table: file path → responsibility]

## Funcionalidades Ativas
[bullet list of features and their status]

## Mudanças Recentes
[last 3-5 sessions: date + what changed]

## Problemas Conhecidos / Cuidados
[known gotchas, things not to break, areas of fragility]

## Convenções
[naming patterns, code style decisions specific to this project]
```

### How It Gets Updated

At the end of each Claude Code session, Claude updates this file with:
- New features added
- Bug fixes made
- Architectural decisions taken
- Any new gotchas or fragile areas discovered

The update is a git commit to the vault repo (or manual save in Obsidian). The file is always current — not a historical log, but a snapshot of the current state. The "Mudanças Recentes" section acts as a rolling window (keeps last 5 sessions, drops older entries).

### Where It Lives

Inside the Obsidian vault:

```
flywise-knowledge/
  context/
    flywise-project-context.md   ← this file
```

Also committed to the FlyWise git repo at `docs/context/flywise-project-context.md` so it's versioned alongside code. Obsidian edits → committed to repo via the sync script or manually.

### What It Is NOT

- Not a substitute for code comments
- Not a changelog (git log serves that)
- Not a full technical spec (those live in `docs/superpowers/specs/`)
- Not synced to Supabase (developer-facing only, not injected into LLM prompts)

---

## Implementation Phases

### Phase 0 — Project Context Doc (immediate, no infrastructure needed)
- Create `docs/context/flywise-project-context.md` in repo
- Write initial version covering current architecture and features
- Establish convention: Claude updates it at the end of every significant session

### Phase 1 — Prompt Extraction (low risk, immediate value)
- Extract strategy Edge Function prompt into `prompts/*.md` files
- Extract chat-busca Edge Function prompt into `prompts/*.md` files
- Verify deploy works, no regression

### Phase 2 — Knowledge Base Infrastructure
- Create `knowledge_base` table in Supabase
- Write `scripts/sync-knowledge.js` sync script
- Create initial Obsidian vault structure with 3-5 seed notes (Smiles, Latam Pass, TAP sweet spots)

### Phase 3 — RAG Injection
- Add `fetchKnowledge()` to strategy Edge Function
- Add `fetchKnowledge()` to chat-busca Edge Function
- Test with real queries, tune token budget and note selection

### Phase 4 — Knowledge Inbox (optional, later)
- Create `knowledge_inbox` table
- Semi-automated flow for structural news updates
- Human review UI (simple Supabase Studio view or admin page)

---

## Open Questions / Future Decisions

- **Obsidian → Supabase sync method**: manual script run vs. Git Action trigger vs. Obsidian plugin with Supabase connector. V1 = manual script.
- **`TRANSFER_BASES` migration**: the hardcoded base ratios in `strategy/index.ts` could eventually become knowledge base notes. Deferred — current approach works fine and promos table handles time-limited bonuses.
- **Prompt drafting in Obsidian**: team can keep a `prompts/` folder in the vault as a drafting space, then copy approved text to the repo. No sync automation needed — copy/paste is sufficient.
