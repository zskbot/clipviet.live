PRAGMA foreign_keys = ON;

-- Defense in depth: a provider cannot be enabled without current rights evidence.
CREATE TRIGGER IF NOT EXISTS trg_provider_registry_enable_guard_insert
BEFORE INSERT ON provider_registry
WHEN NEW.status = 'ENABLED' AND (
  length(trim(COALESCE(NEW.rights_holder, ''))) = 0 OR
  length(trim(COALESCE(NEW.license_reference, ''))) = 0 OR
  length(trim(COALESCE(NEW.rights_evidence_url, ''))) = 0 OR
  julianday(NEW.license_expires_at) IS NULL OR
  julianday(NEW.license_expires_at) <= julianday('now')
)
BEGIN
  SELECT RAISE(ABORT, 'provider cannot be enabled without valid rights evidence and a future license expiry');
END;

CREATE TRIGGER IF NOT EXISTS trg_provider_registry_enable_guard_update
BEFORE UPDATE OF status, rights_holder, license_reference, rights_evidence_url, license_expires_at
ON provider_registry
WHEN NEW.status = 'ENABLED' AND (
  length(trim(COALESCE(NEW.rights_holder, ''))) = 0 OR
  length(trim(COALESCE(NEW.license_reference, ''))) = 0 OR
  length(trim(COALESCE(NEW.rights_evidence_url, ''))) = 0 OR
  julianday(NEW.license_expires_at) IS NULL OR
  julianday(NEW.license_expires_at) <= julianday('now')
)
BEGIN
  SELECT RAISE(ABORT, 'provider cannot be enabled without valid rights evidence and a future license expiry');
END;

-- External sources may only expose playback after verification and explicit rights approval.
CREATE TRIGGER IF NOT EXISTS trg_external_source_playback_guard_insert
BEFORE INSERT ON external_source_registry
WHEN NEW.playback_enabled = 1 AND (
  NEW.status <> 'VERIFIED' OR NEW.rights_status <> 'APPROVED'
)
BEGIN
  SELECT RAISE(ABORT, 'external source playback requires VERIFIED status and APPROVED rights');
END;

CREATE TRIGGER IF NOT EXISTS trg_external_source_playback_guard_update
BEFORE UPDATE OF playback_enabled, status, rights_status
ON external_source_registry
WHEN NEW.playback_enabled = 1 AND (
  NEW.status <> 'VERIFIED' OR NEW.rights_status <> 'APPROVED'
)
BEGIN
  SELECT RAISE(ABORT, 'external source playback requires VERIFIED status and APPROVED rights');
END;

-- Keep the D1 schema ledger in sync with the migration file.
INSERT OR IGNORE INTO schema_migrations (name)
VALUES ('0007_provider_registry_rights_guards.sql');
