PRAGMA foreign_keys = ON;

-- Per-video provenance and rights evidence. A provider-level license is not
-- sufficient to authorize every clip returned by that provider.
CREATE TABLE IF NOT EXISTS provider_content_rights (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES provider_registry(id),
  source_platform TEXT NOT NULL,
  source_content_id TEXT NOT NULL,
  source_url TEXT NOT NULL,
  creator TEXT NOT NULL,
  rights_holder TEXT NOT NULL,
  license_reference TEXT NOT NULL,
  evidence_url TEXT NOT NULL,
  license_expires_at TEXT NOT NULL,
  permitted_uses_json TEXT NOT NULL,
  regions_json TEXT NOT NULL,
  source_verified INTEGER NOT NULL CHECK (source_verified IN (0,1)),
  ownership_verified INTEGER NOT NULL CHECK (ownership_verified IN (0,1)),
  performer_age_verified INTEGER NOT NULL CHECK (performer_age_verified IN (0,1)),
  performer_consent_verified INTEGER NOT NULL CHECK (performer_consent_verified IN (0,1)),
  status TEXT NOT NULL CHECK (status IN ('PENDING','APPROVED','REJECTED','REVOKED')),
  legal_evidence_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(provider_id, source_platform, source_content_id)
);

CREATE INDEX IF NOT EXISTS idx_provider_content_rights_status
  ON provider_content_rights(provider_id, status, license_expires_at);

-- A provider may connect only through a separately reviewed connector contract.
CREATE TABLE IF NOT EXISTS provider_connectors (
  provider_id TEXT PRIMARY KEY REFERENCES provider_registry(id),
  connector_id TEXT NOT NULL,
  auth_mode TEXT NOT NULL CHECK (auth_mode IN ('none','api_key','oauth2','signed_request')),
  scopes_json TEXT NOT NULL,
  regions_json TEXT NOT NULL,
  playback_mode TEXT NOT NULL CHECK (playback_mode IN ('official_embed','owner_hosted_stream','metadata_only','none')),
  documentation_url TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING','APPROVED','DISABLED')),
  evidence_reference TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_provider_connectors_status
  ON provider_connectors(status, connector_id);
