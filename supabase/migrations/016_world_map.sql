-- ============================================================
-- Fly Wise – Mapa de viagens do usuário (países visitados / wishlist)
-- ============================================================

CREATE TABLE IF NOT EXISTS visited_countries (
  id           BIGSERIAL PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  country_code TEXT NOT NULL,  -- ISO 3166-1 alpha-2 (ex: "BR", "US", "FR")
  status       TEXT NOT NULL DEFAULT 'visited' CHECK (status IN ('visited', 'wishlist')),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, country_code)
);

ALTER TABLE visited_countries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own visited countries" ON visited_countries;
CREATE POLICY "Users can manage own visited countries" ON visited_countries
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_visited_countries_user ON visited_countries(user_id);
