-- Migration 024: Adiciona novas categorias de alerta às preferências de notificação
ALTER TABLE notification_preferences
  ADD COLUMN IF NOT EXISTS alerta_acumulo  BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS alerta_noticias BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS alerta_compras  BOOLEAN DEFAULT false;

COMMENT ON COLUMN notification_preferences.alerta_acumulo  IS 'Alertas de promoções de acúmulo (ex: 15 pts/real na Natura)';
COMMENT ON COLUMN notification_preferences.alerta_noticias IS 'Alertas de notícias do setor aéreo (novas rotas, regulamentações)';
COMMENT ON COLUMN notification_preferences.alerta_compras  IS 'Alertas de ofertas e compras (descontos, câmbio, contas internacionais)';
