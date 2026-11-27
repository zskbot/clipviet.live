-- Apply only to clipviet-provider-registry-preview.
CREATE TABLE IF NOT EXISTS schema_migrations (
  name TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_provider_registry_status ON provider_registry(status, name);
CREATE INDEX IF NOT EXISTS idx_provider_audit_provider_created ON provider_audit(provider_id, created_at);
CREATE INDEX IF NOT EXISTS idx_provider_rights_status_expiry ON provider_content_rights(status, license_expires_at);
CREATE INDEX IF NOT EXISTS idx_provider_diagnostics_provider_checked ON provider_diagnostic_runs(provider_id, checked_at);
CREATE INDEX IF NOT EXISTS idx_metadata_intake_status_created ON provider_metadata_intake(status, created_at);
INSERT OR IGNORE INTO schema_migrations(name) VALUES ('0004_provider_registry_query_indexes.sql');
