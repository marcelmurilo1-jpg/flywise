-- ─── Knowledge Base ──────────────────────────────────────────────────────────
-- Notas de domínio do mundo de milhas (sweet spots, alianças, routing tricks)
-- Autoria: equipe FlyWise via vault Obsidian → sync via scripts/sync-knowledge.js
-- Uso: injetadas nas Edge Functions strategy e chat-busca via RAG por tags

create table if not exists knowledge_base (
    id          uuid primary key default gen_random_uuid(),
    slug        text unique not null,           -- ex: 'smiles-sweet-spots'
    title       text not null,
    content     text not null,                  -- corpo da nota em markdown
    programs    text[] not null default '{}',   -- ex: ['smiles', 'latam pass']
    topics      text[] not null default '{}',   -- ex: ['sweet-spots', 'routing']
    routes      text[] not null default '{}',   -- ex: ['brasil-eua', 'global']
    updated_at  timestamptz not null default now(),
    active      boolean not null default true
);

create index if not exists knowledge_base_programs_gin on knowledge_base using gin(programs);
create index if not exists knowledge_base_topics_gin   on knowledge_base using gin(topics);
create index if not exists knowledge_base_routes_gin   on knowledge_base using gin(routes);
create index if not exists knowledge_base_active_idx   on knowledge_base(active);

-- ─── Knowledge Inbox ─────────────────────────────────────────────────────────
-- Atualizações semi-automáticas (ex: quebra de aliança, mudança de ratio)
-- Requer revisão humana antes de ir para knowledge_base

create table if not exists knowledge_inbox (
    id         uuid primary key default gen_random_uuid(),
    slug       text,
    source     text,                            -- ex: 'news-scraper', 'manual'
    title      text,
    content    text,
    programs   text[] default '{}',
    topics     text[] default '{}',
    status     text not null default 'pending'
               check (status in ('pending', 'approved', 'rejected')),
    created_at timestamptz not null default now()
);

-- RLS: leitura pública de notas ativas; escrita apenas via service role
alter table knowledge_base enable row level security;
alter table knowledge_inbox enable row level security;

create policy "knowledge_base_leitura_publica" on knowledge_base
    for select using (active = true);

create policy "knowledge_inbox_somente_service_role" on knowledge_inbox
    for all using (false);
