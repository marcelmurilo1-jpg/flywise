-- ============================================================
-- Fly Wise — Migração 002: Adapta tabela promocoes para o scraper
-- Execute no SQL Editor do Supabase antes de rodar o scraper
-- ============================================================

-- Adiciona colunas que o scraper precisa (se ainda não existirem)
ALTER TABLE promocoes
  ADD COLUMN IF NOT EXISTS url    TEXT,
  ADD COLUMN IF NOT EXISTS fonte  TEXT DEFAULT 'passageirodeprimeira.com',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Garante unicidade por URL (evita duplicatas no upsert)
-- Cria o índice unique apenas se ainda não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'promocoes_url_key'
  ) THEN
    ALTER TABLE promocoes ADD CONSTRAINT promocoes_url_key UNIQUE (url);
  END IF;
END $$;

-- Política RLS: qualquer usuário autenticado pode LER promoções
DROP POLICY IF EXISTS "Leitura pública de promoções" ON promocoes;
CREATE POLICY "Leitura pública de promoções"
  ON promocoes FOR SELECT
  USING (true);

-- Apenas service_role (scraper) pode INSERIR / ATUALIZAR / DELETAR
-- (RLS já bloqueia anon/authenticated por padrão para INSERT/UPDATE/DELETE)

-- View atualizada que só retorna promoções ainda válidas
CREATE OR REPLACE VIEW vw_promocoes_ativas AS
  SELECT *
  FROM   promocoes
  WHERE  valid_until IS NULL OR valid_until > NOW()
  ORDER  BY created_at DESC;
