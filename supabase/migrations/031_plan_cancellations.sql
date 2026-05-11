-- Migration 031: Track plan cancellations and reasons
CREATE TABLE IF NOT EXISTS plan_cancellations (
  id            BIGSERIAL    PRIMARY KEY,
  user_id       UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan          TEXT,
  reason        TEXT         NOT NULL,
  reason_detail TEXT,
  cancelled_at  TIMESTAMPTZ  DEFAULT NOW()
);

ALTER TABLE plan_cancellations ENABLE ROW LEVEL SECURITY;

-- Only admins can read via service role; users cannot read their own rows
CREATE POLICY "admin_only" ON plan_cancellations FOR ALL USING (FALSE);

CREATE INDEX idx_plan_cancellations_user_id ON plan_cancellations (user_id);
