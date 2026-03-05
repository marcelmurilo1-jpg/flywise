-- Migration: user_profiles table
-- Stores extended profile data for each user

CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  birth_date DATE,
  nationality TEXT,
  default_traveler_type TEXT DEFAULT 'casal',
  preferred_styles TEXT[] DEFAULT '{}',
  preferred_currency TEXT DEFAULT 'BRL',
  notifications_email BOOLEAN NOT NULL DEFAULT TRUE,
  notifications_promotions BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_own_profile" ON user_profiles
  FOR ALL USING (auth.uid() = id);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
