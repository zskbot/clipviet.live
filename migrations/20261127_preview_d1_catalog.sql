-- Applied to clipviet-cms-preview (Preview D1 only) on 2026-11-27.
-- Adds explicit fixture semantics and a pending-only external source registry.
ALTER TABLE clipviet_videos ADD COLUMN is_demo INTEGER NOT NULL DEFAULT 0;
ALTER TABLE clipviet_videos ADD COLUMN demo_schema_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE clipviet_videos ADD COLUMN content_type TEXT NOT NULL DEFAULT 'video';

CREATE TABLE IF NOT EXISTS provider_candidates (
  id TEXT PRIMARY KEY NOT NULL,
  domain TEXT NOT NULL UNIQUE,
  homepage_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','review','approved','rejected')),
  source_type TEXT NOT NULL DEFAULT 'user_supplied_reference',
  rights_review_required INTEGER NOT NULL DEFAULT 1 CHECK(rights_review_required IN (0,1)),
  fetching_enabled INTEGER NOT NULL DEFAULT 0 CHECK(fetching_enabled IN (0,1)),
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_provider_candidates_status ON provider_candidates(status, domain);

-- The four demo rows are synthetic UI fixtures. They have no media URLs,
-- remain rights-pending, and are not eligible for playback.
UPDATE clipviet_videos
SET is_demo=1, demo_schema_version=1, content_type='ui_fixture',
    video_url='', poster_url='', rights_status='pending', rights_evidence_url='',
    rights_notes='Synthetic UI fixture only. No real media, no distribution approval, and playback is disabled.',
    status='published', published_at=COALESCE(published_at, datetime('now')), updated_at=datetime('now')
WHERE id IN ('demo-cv-001','demo-cv-002','demo-cv-003','demo-cv-004');

-- User-supplied candidate domains only: no crawler, API polling, indexing or playback.
