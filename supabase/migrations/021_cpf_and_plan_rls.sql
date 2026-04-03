-- Migration: add cpf column and restrict plan field updates from client

-- 1. CPF field for PIX billing requirement
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS cpf TEXT;

-- 2. Prevent users from self-assigning plan/expiry via the client SDK.
--    Only service_role (backend webhook) can change plan fields.
CREATE POLICY "block_self_plan_elevation" ON user_profiles
  AS RESTRICTIVE
  FOR UPDATE
  USING (TRUE)
  WITH CHECK (
    plan            = (SELECT plan            FROM user_profiles WHERE id = auth.uid()) AND
    plan_expires_at = (SELECT plan_expires_at FROM user_profiles WHERE id = auth.uid()) AND
    plan_billing    = (SELECT plan_billing    FROM user_profiles WHERE id = auth.uid())
  );
