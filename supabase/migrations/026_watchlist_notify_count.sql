-- Rastreia quantas notificações foram enviadas por item da watchlist.
-- Usado para auto-desativar após MAX_NOTIFY disparos.

ALTER TABLE watchlist_items
  ADD COLUMN IF NOT EXISTS notify_count INTEGER NOT NULL DEFAULT 0;
