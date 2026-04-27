-- Migration 023: Adiciona preco_clube às promoções de clube de fidelidade
-- Permite calcular ROI do clube no contexto de uma emissão específica

ALTER TABLE promocoes
  ADD COLUMN IF NOT EXISTS preco_clube NUMERIC(8,2); -- R$/mês ex: 34.90

COMMENT ON COLUMN promocoes.preco_clube IS 'Preço mensal do clube de fidelidade (R$/mês). Ex: 34.90 para Club Smiles.';

-- bonus_pct já existe — para promos de clube representa o desconto na COMPRA de milhas (%)
-- Ex: Club Smiles dá 20% OFF na compra → bonus_pct = 20
COMMENT ON COLUMN promocoes.bonus_pct IS 'Para tipo=bonus_transferencia: % de bônus na transferência. Para subcategoria=clube: % de desconto na compra de milhas.';
