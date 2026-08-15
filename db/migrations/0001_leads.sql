CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  preferred_contact TEXT NOT NULL DEFAULT 'whatsapp',
  message TEXT,
  consent INTEGER NOT NULL DEFAULT 0,
  source_page TEXT,
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  ip_hash TEXT,
  status TEXT NOT NULL DEFAULT 'novo'
);

CREATE INDEX IF NOT EXISTS leads_created_at_idx ON leads(created_at);
CREATE INDEX IF NOT EXISTS leads_ip_hash_idx ON leads(ip_hash);
CREATE INDEX IF NOT EXISTS leads_status_idx ON leads(status);
