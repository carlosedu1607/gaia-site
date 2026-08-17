CREATE TABLE IF NOT EXISTS whatsapp_events (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  button_id TEXT NOT NULL,
  source_page TEXT,
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  ip_hash TEXT,
  status TEXT NOT NULL DEFAULT 'novo',
  assigned_to TEXT,
  next_action TEXT
);

CREATE INDEX IF NOT EXISTS whatsapp_events_created_at_idx ON whatsapp_events(created_at);
CREATE INDEX IF NOT EXISTS whatsapp_events_ip_hash_idx ON whatsapp_events(ip_hash);
CREATE INDEX IF NOT EXISTS whatsapp_events_status_idx ON whatsapp_events(status);
