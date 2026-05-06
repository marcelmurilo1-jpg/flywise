-- 030_ai_summary_base_ratio.sql
-- ai_summary: resumo estruturado gerado por Haiku (ratio, mínimo, condições) — substitui titulo nas injeções de contexto para IA
-- ai_processed_at: timestamp do processamento, NULL = ainda não processado
-- base_ratio: ratio base de transferência em transfer_promotions (ex: 1.0 = 1:1, 0.5 = 2:1)

ALTER TABLE promocoes
  ADD COLUMN IF NOT EXISTS ai_summary       TEXT,
  ADD COLUMN IF NOT EXISTS ai_processed_at  TIMESTAMPTZ;

ALTER TABLE transfer_promotions
  ADD COLUMN IF NOT EXISTS base_ratio DECIMAL(5,3);

-- Index para buscar promoções que ainda precisam ser processadas
CREATE INDEX IF NOT EXISTS idx_promocoes_ai_unprocessed
  ON promocoes (created_at DESC)
  WHERE ai_processed_at IS NULL;
