-- Apply only to clipviet-rights-preview.
CREATE INDEX IF NOT EXISTS idx_rights_provider_status_expiry
  ON provider_content_rights(provider_id, status, license_expires_at);
CREATE INDEX IF NOT EXISTS idx_rights_audit_provider_created
  ON provider_audit(provider_id, created_at);
CREATE INDEX IF NOT EXISTS idx_rights_connectors_status
  ON provider_connectors(status, provider_id);
INSERT OR IGNORE INTO schema_migrations(name)
VALUES ('0004_rights_query_indexes.sql');
