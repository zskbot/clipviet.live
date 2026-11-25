CREATE TABLE IF NOT EXISTS articles (
  id TEXT PRIMARY KEY NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL CHECK(length(title) BETWEEN 2 AND 160),
  excerpt TEXT NOT NULL DEFAULT '' CHECK(length(excerpt) <= 320),
  body TEXT NOT NULL CHECK(length(body) <= 50000),
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  published_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_articles_status_published_at ON articles(status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_updated_at ON articles(updated_at DESC);
