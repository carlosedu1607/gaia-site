CREATE TABLE IF NOT EXISTS weekly_whatsapp_reports (
  id TEXT PRIMARY KEY,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  clicks_count INTEGER NOT NULL DEFAULT 0,
  sent_at TEXT NOT NULL DEFAULT (datetime('now')),
  status TEXT NOT NULL DEFAULT 'enviado',
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS weekly_reports_period_idx ON weekly_whatsapp_reports(period_start, period_end);
CREATE INDEX IF NOT EXISTS weekly_reports_status_idx ON weekly_whatsapp_reports(status);
