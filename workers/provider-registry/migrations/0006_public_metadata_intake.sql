-- Public metadata-only provider intake. This table is deliberately separate from
-- provider_registry and provider_connectors: submissions never approve or activate a provider.
CREATE TABLE IF NOT EXISTS provider_metadata_intake (
  id TEXT PRIMARY KEY NOT NULL,
  provider_id TEXT NOT NULL,
  provider_name TEXT NOT NULL,
  api_host TEXT NOT NULL,
  api_base_url TEXT NOT NULL,
  rights_holder TEXT NOT NULL,
  license_reference TEXT NOT NULL,
  evidence_url TEXT NOT NULL,
  documentation_url TEXT NOT NULL,
  license_expires_at TEXT NOT NULL,
  regions_json TEXT NOT NULL,
  contact_email TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'PENDING_REVIEW'
    CHECK(status IN ('PENDING_REVIEW','ACCEPTED_FOR_REVIEW','REJECTED','CONVERTED_TO_PROVIDER')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_provider_metadata_intake_status
  ON provider_metadata_intake(status, provider_id, created_at);
