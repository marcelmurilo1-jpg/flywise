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
