PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS provider_registry (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING','VERIFIED','APPROVED','ENABLED')),
  api_base_url TEXT NOT NULL,
  api_host TEXT NOT NULL,
  media_hosts_json TEXT NOT NULL,
  rights_holder TEXT NOT NULL,
  license_reference TEXT NOT NULL,
  rights_evidence_url TEXT NOT NULL,
  license_expires_at TEXT NOT NULL,
  api_credential_ciphertext TEXT,
  technical_evidence_json TEXT,
  legal_evidence_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_event_id TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_provider_registry_status_created
  ON provider_registry(status, created_at DESC);

CREATE TABLE IF NOT EXISTS provider_audit (
  event_id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES provider_registry(id),
  action TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  actor_role TEXT NOT NULL CHECK (actor_role IN ('admin','technical','legal')),
  metadata_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_provider_audit_provider_created
  ON provider_audit(provider_id, created_at DESC);
