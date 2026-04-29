-- Armazena o último preço visto para detectar quedas reais de preço
-- (substitui cooldown por tempo — notifica só quando o preço cai de verdade)

ALTER TABLE watchlist_items
  ADD COLUMN IF NOT EXISTS last_price_brl    NUMERIC,
  ADD COLUMN IF NOT EXISTS last_price_miles  INTEGER;
