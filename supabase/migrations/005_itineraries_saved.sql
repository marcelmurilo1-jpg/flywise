-- Migration: add is_saved flag to itineraries

ALTER TABLE itineraries ADD COLUMN IF NOT EXISTS is_saved BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_itineraries_saved ON itineraries (user_id, is_saved, created_at DESC);
