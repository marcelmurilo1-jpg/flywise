-- Migration 012: Adiciona subcategoria às promoções de milhas
-- 'transferencia' = bônus de transferência entre programas
-- 'clube'         = promoções de clubes de assinatura (Club Smiles, TudoAzul Família, etc.)

ALTER TABLE promocoes
  ADD COLUMN IF NOT EXISTS subcategoria TEXT;

CREATE INDEX IF NOT EXISTS idx_promocoes_subcategoria
  ON promocoes (subcategoria)
  WHERE subcategoria IS NOT NULL;
