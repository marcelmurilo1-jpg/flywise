-- ============================================================
-- FlyWise — Migração 009: Colunas de classificação e controle de notificações
-- Execute no Supabase → SQL Editor → New Query
-- ============================================================

-- Adiciona colunas necessárias para o pipeline de notificação
ALTER TABLE promocoes
  ADD COLUMN IF NOT EXISTS categoria      TEXT,            -- 'passagens' | 'milhas'
  ADD COLUMN IF NOT EXISTS programas_tags TEXT[],          -- ['Smiles','TudoAzul', ...]
  ADD COLUMN IF NOT EXISTS notificado_em  TIMESTAMPTZ;     -- NULL = ainda não notificou

-- Índice para busca eficiente de promoções não notificadas
CREATE INDEX IF NOT EXISTS idx_promocoes_notificado_em
  ON promocoes (notificado_em)
  WHERE notificado_em IS NULL;

-- Índice para filtragem por categoria
CREATE INDEX IF NOT EXISTS idx_promocoes_categoria
  ON promocoes (categoria);
