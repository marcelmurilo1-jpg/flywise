-- ============================================================
-- Fly Wise — Migração 003: LLM context builder support
-- Execute no Supabase → SQL Editor → New Query
-- ============================================================

-- 1. Adiciona coluna `programa` na tabela promocoes
--    (permite filtrar promoções por programa de milhas)
ALTER TABLE promocoes
  ADD COLUMN IF NOT EXISTS programa    TEXT,
  ADD COLUMN IF NOT EXISTS tipo        TEXT,       -- 'bonus_transferencia' | 'passagem' | 'milhas_dobro'
  ADD COLUMN IF NOT EXISTS bonus_pct   INTEGER,    -- ex: 40 (= 40% de bônus)
  ADD COLUMN IF NOT EXISTS parceiro    TEXT;       -- ex: 'Nubank', 'Itaú'

-- Índice para filtrar por programa rapidamente
CREATE INDEX IF NOT EXISTS idx_promocoes_programa ON promocoes (programa);
CREATE INDEX IF NOT EXISTS idx_promocoes_tipo     ON promocoes (tipo);

-- 2. Adiciona coluna `structured_result` em strategies
--    (armazena a resposta JSON estruturada da LLM)
ALTER TABLE strategies
  ADD COLUMN IF NOT EXISTS structured_result  JSONB,
  ADD COLUMN IF NOT EXISTS llm_model          TEXT DEFAULT 'gpt-4o-mini',
  ADD COLUMN IF NOT EXISTS tokens_used        INTEGER,
  ADD COLUMN IF NOT EXISTS flight_id          BIGINT REFERENCES resultados_voos(id) ON DELETE SET NULL;

-- Índice para buscar estratégias por voo
CREATE INDEX IF NOT EXISTS idx_strategies_flight ON strategies (flight_id);

-- 3. Comentários
COMMENT ON COLUMN promocoes.programa IS 'Ex: Smiles, LATAM Pass, TudoAzul, Livelo';
COMMENT ON COLUMN promocoes.tipo     IS 'bonus_transferencia | passagem_promoca | milhas_dobro | cashback';
COMMENT ON COLUMN strategies.structured_result IS 'JSON da LLM: {programa_recomendado, steps[], milhas_necessarias, ...}';
