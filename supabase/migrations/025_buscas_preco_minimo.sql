-- Adiciona coluna de preço mínimo encontrado na busca
-- Populada pelo Resultados.tsx após encontrar voos via Amadeus

ALTER TABLE buscas
  ADD COLUMN IF NOT EXISTS preco_minimo_brl NUMERIC;
