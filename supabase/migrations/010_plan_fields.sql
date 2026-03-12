-- Migration: add subscription plan fields to user_profiles

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS plan_billing TEXT; -- 'mensal' | 'anual'

-- Index for fast plan lookups (used by Edge Functions)
CREATE INDEX IF NOT EXISTS idx_user_profiles_plan ON user_profiles (id, plan);
