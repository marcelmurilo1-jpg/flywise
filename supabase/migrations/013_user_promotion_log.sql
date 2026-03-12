-- Migration 013: Log de promoções enviadas por usuário
-- Substitui o controle global via notificado_em por rastreamento individual,
-- permitindo que usuários novos ou que reativaram alertas recebam promoções
-- que outros usuários já receberam.

CREATE TABLE IF NOT EXISTS user_promotion_log (
  user_id      UUID   NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  promotion_id BIGINT NOT NULL REFERENCES promocoes(id)  ON DELETE CASCADE,
  sent_at      TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, promotion_id)
);

CREATE INDEX IF NOT EXISTS idx_user_promotion_log_user_id
  ON user_promotion_log (user_id);

ALTER TABLE user_promotion_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_own_promotion_log" ON user_promotion_log
  FOR SELECT USING (auth.uid() = user_id);
