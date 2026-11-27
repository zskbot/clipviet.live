-- Apply only to clipviet-cms-preview.
CREATE TABLE IF NOT EXISTS schema_migrations (
  name TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_videos_status_published ON clipviet_videos(status, published_at);
CREATE INDEX IF NOT EXISTS idx_videos_rights_status ON clipviet_videos(rights_status, status);
CREATE INDEX IF NOT EXISTS idx_candidates_status ON provider_candidates(status, created_at);
CREATE INDEX IF NOT EXISTS idx_articles_status_published ON articles(status, published_at);
INSERT OR IGNORE INTO schema_migrations(name) VALUES ('0004_cms_query_indexes.sql');
