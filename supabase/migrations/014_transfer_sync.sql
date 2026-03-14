-- ─── 014_transfer_sync.sql ────────────────────────────────────────────────────
-- Cria tabela transfer_promotions (fonte de verdade do Simulador de Transferência)
-- e transfer_sync_log (histórico do sync automático diário).

-- Tabela principal de promoções de transferência
create table if not exists transfer_promotions (
    id                  uuid primary key default gen_random_uuid(),
    card_id             text not null,
    program             text not null,
    bonus_percent       integer not null default 0,
    club_bonus_percent  integer not null default 0,
    club_tier_bonuses   jsonb not null default '{}',
    club_required       text,
    valid_until         text not null default '',
    description         text not null default '',
    is_periodic         boolean not null default true,
    last_confirmed      text not null default '',
    rules               jsonb not null default '[]',
    registration_url    text,
    active              boolean not null default true,
    updated_at          timestamptz default now(),
    created_at          timestamptz not null default now()
);

-- Index para busca rápida por cartão/programa
create index if not exists transfer_promotions_card_program_idx
    on transfer_promotions (card_id, program);

create index if not exists transfer_promotions_active_idx
    on transfer_promotions (active);

-- RLS: leitura pública (anon pode ler), escrita apenas service_role
alter table transfer_promotions enable row level security;

create policy "public_read" on transfer_promotions
    for select to anon, authenticated
    using (active = true);

create policy "service_role_all" on transfer_promotions
    for all to service_role
    using (true)
    with check (true);

-- Log de cada execução do sync automático
create table if not exists transfer_sync_log (
    id               uuid primary key default gen_random_uuid(),
    synced_at        timestamptz not null default now(),
    sources_scraped  integer not null default 0,
    changes_detected boolean not null default false,
    rows_updated     integer not null default 0,
    summary          text not null default '',
    created_at       timestamptz not null default now()
);

create index if not exists transfer_sync_log_synced_at_idx
    on transfer_sync_log (synced_at desc);

alter table transfer_sync_log enable row level security;

create policy "service_role_all" on transfer_sync_log
    for all to service_role
    using (true)
    with check (true);
