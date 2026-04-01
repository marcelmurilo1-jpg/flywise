-- Enable RLS on itinerary_research.
-- This table is an internal cache read/written only by the edge function
-- via the service role key, which bypasses RLS. No public policies needed.
alter table itinerary_research enable row level security;
