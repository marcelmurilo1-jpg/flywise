-- Migration: add budget column to itineraries
ALTER TABLE itineraries ADD COLUMN IF NOT EXISTS budget SMALLINT DEFAULT 2;
