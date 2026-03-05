-- Migration: itineraries table
-- Stores AI-generated travel itineraries per user

CREATE TABLE itineraries (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  destination TEXT NOT NULL,
  duration INT NOT NULL,
  traveler_type TEXT NOT NULL,
  travel_style TEXT[] NOT NULL DEFAULT '{}',
  result JSONB,
  tokens_used INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE itineraries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_own_itineraries" ON itineraries
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_itineraries_user ON itineraries (user_id, created_at DESC);
