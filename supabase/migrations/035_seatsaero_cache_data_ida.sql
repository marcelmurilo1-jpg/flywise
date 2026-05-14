-- Adiciona coluna data_ida à tabela seatsaero_searches
-- Necessária para cache por rota+data (estava faltando desde a migration 011)

ALTER TABLE public.seatsaero_searches
    ADD COLUMN IF NOT EXISTS data_ida TEXT;

-- Índice para lookup rápido por rota+data
CREATE INDEX IF NOT EXISTS idx_seatsaero_searches_rota_data
    ON public.seatsaero_searches(origem, destino, data_ida);
