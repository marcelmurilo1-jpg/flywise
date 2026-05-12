-- Migration 033: phone in profiles, partners table, user_id in seatsaero_api_log

-- WhatsApp / phone number on user profile
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS phone TEXT;

-- Track which user triggered each Seats.aero API call
ALTER TABLE seatsaero_api_log ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_seatsaero_api_log_user ON seatsaero_api_log (user_id);

-- Partners / sócios
CREATE TABLE IF NOT EXISTS admin_partners (
  id          BIGSERIAL    PRIMARY KEY,
  name        TEXT         NOT NULL,
  profit_pct  NUMERIC(5,2) DEFAULT 0,   -- % do lucro líquido que recebe
  cost_pct    NUMERIC(5,2) DEFAULT 0,   -- % dos custos que assume
  salary_brl  NUMERIC(10,2) DEFAULT 0,  -- pró-labore / salário fixo mensal
  notes       TEXT,
  active      BOOLEAN      DEFAULT TRUE,
  created_at  TIMESTAMPTZ  DEFAULT NOW()
);

ALTER TABLE admin_partners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_only" ON admin_partners FOR ALL USING (FALSE);
