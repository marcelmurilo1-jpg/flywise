-- Migration: add is_admin flag to user_profiles

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- Only service_role can set is_admin (not the user themselves)
-- The existing "user_own_profile" policy covers SELECT/UPDATE for users,
-- but we need to block users from self-elevating.
-- We revoke UPDATE on is_admin for the authenticated role via a check policy.
CREATE POLICY "block_self_admin_elevation" ON user_profiles
  AS RESTRICTIVE
  FOR UPDATE
  USING (TRUE)
  WITH CHECK (
    -- Users can only update their own row; is_admin must stay the same
    -- unless the request comes from service_role (which bypasses RLS)
    is_admin = (SELECT is_admin FROM user_profiles WHERE id = auth.uid())
  );
