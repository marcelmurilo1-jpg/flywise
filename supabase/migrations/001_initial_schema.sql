-- ============================================================
-- Fly Wise – Schema inicial do Supabase
-- Execute este SQL no Dashboard do Supabase:
--   Settings → SQL Editor → New Query → Cole e execute
-- ============================================================

-- 1. Tabela de buscas (pesquisas do usuário)
CREATE TABLE IF NOT EXISTS buscas (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  origem TEXT NOT NULL,
  destino TEXT NOT NULL,
  data_ida DATE NOT NULL,
  data_volta DATE,
  passageiros INTEGER DEFAULT 1,
  bagagem TEXT DEFAULT 'sem_bagagem',
  banco TEXT,
  user_miles JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabela de promoções (preenchida pelo scraper Python)
-- Se já existir, não recria; o scraper vai inserir os dados.
CREATE TABLE IF NOT EXISTS promocoes (
  id BIGSERIAL PRIMARY KEY,
  titulo TEXT,
  url TEXT,
  valid_until TIMESTAMPTZ,
  conteudo TEXT,
  imagens JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Resultados de voo (mocks por agora, APIs reais depois)
CREATE TABLE IF NOT EXISTS resultados_voos (
  id BIGSERIAL PRIMARY KEY,
  busca_id BIGINT NOT NULL REFERENCES buscas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  provider TEXT,
  companhia TEXT,
  preco_brl NUMERIC,
  preco_milhas INTEGER,
  taxas_brl NUMERIC,
  cpm NUMERIC,
  partida TIMESTAMPTZ,
  chegada TIMESTAMPTZ,
  origem TEXT,
  destino TEXT,
  duracao_min INTEGER,
  cabin_class TEXT DEFAULT 'economy',
  flight_key TEXT,
  estrategia_disponivel BOOLEAN DEFAULT false,
  moeda TEXT DEFAULT 'BRL',
  segmentos JSONB,
  detalhes JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Estratégias geradas pela IA / mock
CREATE TABLE IF NOT EXISTS strategies (
  id BIGSERIAL PRIMARY KEY,
  busca_id BIGINT REFERENCES buscas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  strategy_text TEXT,
  tags TEXT[],
  economia_pct NUMERIC,
  preco_cash NUMERIC,
  preco_estrategia NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================

ALTER TABLE buscas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own searches" ON buscas;
CREATE POLICY "Users can manage own searches" ON buscas
  FOR ALL USING (auth.uid() = user_id);

ALTER TABLE resultados_voos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own flight results" ON resultados_voos;
CREATE POLICY "Users can manage own flight results" ON resultados_voos
  FOR ALL USING (auth.uid() = user_id);

ALTER TABLE strategies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own strategies" ON strategies;
CREATE POLICY "Users can manage own strategies" ON strategies
  FOR ALL USING (auth.uid() = user_id);

-- Promoções: leitura pública (insert via service role pelo scraper)
ALTER TABLE promocoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read promotions" ON promocoes;
CREATE POLICY "Public read promotions" ON promocoes
  FOR SELECT USING (true);

-- ============================================================
-- Indexes para performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_buscas_user ON buscas(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_resultados_busca ON resultados_voos(busca_id, user_id);
CREATE INDEX IF NOT EXISTS idx_strategies_busca ON strategies(busca_id, user_id);
CREATE INDEX IF NOT EXISTS idx_promocoes_created ON promocoes(created_at DESC);

-- ============================================================
-- View de promoções ativas (válidas ou sem data de expiração)
-- ============================================================
CREATE OR REPLACE VIEW vw_promocoes_ativas AS
  SELECT *
  FROM promocoes
  WHERE valid_until IS NULL OR valid_until > NOW()
  ORDER BY created_at DESC;
