-- Migration: chat_conversations
-- Stores Busca Avançada IA chat sessions

create table if not exists public.chat_conversations (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null references auth.users(id) on delete cascade,
    title       text not null default 'Busca sem título',
    wizard_data jsonb not null default '{}',
    messages    jsonb not null default '[]',
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

-- RLS
alter table public.chat_conversations enable row level security;

create policy "Users can manage their own conversations"
    on public.chat_conversations
    for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

-- Auto-update updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create trigger chat_conversations_updated_at
    before update on public.chat_conversations
    for each row execute function public.set_updated_at();
