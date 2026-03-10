-- Migration: notification_preferences
-- Armazena preferências de notificação dos usuários

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id             UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  notificacoes_ativas BOOLEAN   DEFAULT false,
  passagens           BOOLEAN   DEFAULT false,
  milhas              BOOLEAN   DEFAULT false,
  programas           TEXT[]    DEFAULT '{}',
  alerta_promocao     BOOLEAN   DEFAULT true,
  alerta_award_space  BOOLEAN   DEFAULT true,
  configurado_em      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_own_notification_preferences" ON notification_preferences
  FOR ALL USING (auth.uid() = user_id);
