-- Migration 024: Adiciona alerta_acumulo às preferências de notificação
ALTER TABLE notification_preferences
  ADD COLUMN IF NOT EXISTS alerta_acumulo BOOLEAN DEFAULT false;

COMMENT ON COLUMN notification_preferences.alerta_acumulo IS 'Alertas de promoções de acúmulo (ex: 15 pts/real na Natura)';
