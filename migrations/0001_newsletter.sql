-- Newsletter (Boletim GLCTech) — schema inicial.
-- Aplicar com:
--   wrangler d1 migrations apply glctech-newsletter --local
--   wrangler d1 migrations apply glctech-newsletter --remote

CREATE TABLE subscribers (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  email            TEXT NOT NULL UNIQUE COLLATE NOCASE,
  status           TEXT NOT NULL DEFAULT 'pending',   -- pending | active | unsubscribed
  consent_text     TEXT NOT NULL,                     -- texto exato aceito (LGPD)
  consent_ip       TEXT,
  consent_at       TEXT NOT NULL,
  confirmed_at     TEXT,
  unsubscribed_at  TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE issues (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  status       TEXT NOT NULL DEFAULT 'draft',         -- draft | approved | sent | failed
  subject      TEXT NOT NULL,
  content_json TEXT NOT NULL,
  sources_json TEXT NOT NULL,
  test_mode    INTEGER NOT NULL,
  sent_count   INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  approved_at  TEXT,
  sent_at      TEXT
);

CREATE TABLE company_news (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT NOT NULL,
  summary     TEXT NOT NULL,
  url         TEXT,
  used_in     INTEGER REFERENCES issues(id),
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_subscribers_status ON subscribers(status);
