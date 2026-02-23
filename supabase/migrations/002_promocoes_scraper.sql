-- ============================================================
-- Fly Wise — Migração 002: Cria/adapta tabela promocoes para o scraper
-- Execute no Supabase → SQL Editor → New Query
-- ============================================================

-- Cria a tabela completa (com todos os campos que o scraper precisa)
CREATE TABLE IF NOT EXISTS promocoes (
  id          BIGSERIAL PRIMARY KEY,
  titulo      TEXT,
  url         TEXT UNIQUE,                            -- unique: evita duplicatas no upsert
  conteudo    TEXT,
  fonte       TEXT DEFAULT 'passageirodeprimeira.com',
  valid_until TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Se a tabela já existia sem as novas colunas, adiciona individualmente:
ALTER TABLE promocoes
  ADD COLUMN IF NOT EXISTS fonte       TEXT DEFAULT 'passageirodeprimeira.com',
  ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMPTZ DEFAULT NOW();

-- Garante unicidade por URL (caso a tabela já existisse sem constraint)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'promocoes_url_key'
  ) THEN
    ALTER TABLE promocoes ADD CONSTRAINT promocoes_url_key UNIQUE (url);
  END IF;
END $$;

-- Habilita RLS
ALTER TABLE promocoes ENABLE ROW LEVEL SECURITY;

-- Qualquer um pode LER promoções (sem precisar de login)
DROP POLICY IF EXISTS "Leitura publica promocoes" ON promocoes;
CREATE POLICY "Leitura publica promocoes"
  ON promocoes FOR SELECT USING (true);

-- View que só retorna promoções ainda válidas (o app usa esta view)
CREATE OR REPLACE VIEW vw_promocoes_ativas AS
  SELECT *
  FROM   promocoes
  WHERE  valid_until IS NULL OR valid_until > NOW()
  ORDER  BY created_at DESC;
