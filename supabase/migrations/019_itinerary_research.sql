-- Cache de pesquisa por destino para geração de roteiros com IA
-- TTL: 7 dias (verificado na Edge Function)
create table if not exists itinerary_research (
    destination text primary key,
    snippets    jsonb        not null default '{}',
    created_at  timestamptz  not null default now()
);

comment on table itinerary_research is
    'Cache de snippets de pesquisa web (TripAdvisor, Lonely Planet, etc.) por destino. TTL de 7 dias.';

comment on column itinerary_research.snippets is
    'JSON com chaves: tripadvisor_top, locals_recommend, restaurantes, tendencias. Populado pela web search quando disponível.';
