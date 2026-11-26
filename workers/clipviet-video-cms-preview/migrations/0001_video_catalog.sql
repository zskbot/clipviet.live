CREATE TABLE IF NOT EXISTS clipviet_videos (
  id TEXT PRIMARY KEY NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL CHECK(length(title) BETWEEN 2 AND 160),
  description TEXT NOT NULL DEFAULT '' CHECK(length(description) <= 5000),
  video_url TEXT NOT NULL DEFAULT '',
  poster_url TEXT NOT NULL DEFAULT '',
  tags_json TEXT NOT NULL DEFAULT '[]',
  groups_json TEXT NOT NULL DEFAULT '[]',
  rights_status TEXT NOT NULL DEFAULT 'pending' CHECK(rights_status IN ('pending','approved','rejected')),
  rights_evidence_url TEXT NOT NULL DEFAULT '',
  rights_notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  published_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_clipviet_videos_status_updated
  ON clipviet_videos(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_clipviet_videos_published
  ON clipviet_videos(status, published_at DESC);
