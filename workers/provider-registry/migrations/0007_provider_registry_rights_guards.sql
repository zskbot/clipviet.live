PRAGMA foreign_keys = ON;

-- Defense in depth: registry status changes must not bypass the application rights gate.
-- This migration is additive and safe to re-run.

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

CREATE TRIGGER IF NOT EXISTS trg_provider_connector_approval_guard_insert
BEFORE INSERT ON provider_connectors
WHEN NEW.status = 'APPROVED' AND (
  length(trim(COALESCE(NEW.documentation_url, ''))) = 0 OR
  length(trim(COALESCE(NEW.evidence_reference, ''))) = 0 OR
  NOT EXISTS (
    SELECT 1 FROM provider_registry p
    WHERE p.id = NEW.provider_id
      AND p.status IN ('VERIFIED', 'APPROVED', 'ENABLED')
      AND length(trim(COALESCE(p.rights_holder, ''))) > 0
      AND length(trim(COALESCE(p.license_reference, ''))) > 0
      AND length(trim(COALESCE(p.rights_evidence_url, ''))) > 0
      AND julianday(p.license_expires_at) > julianday('now')
  )
)
BEGIN
  SELECT RAISE(ABORT, 'connector cannot be approved without verified provider rights and evidence');
END;

CREATE TRIGGER IF NOT EXISTS trg_provider_connector_approval_guard_update
BEFORE UPDATE OF status, documentation_url, evidence_reference, provider_id
ON provider_connectors
WHEN NEW.status = 'APPROVED' AND (
  length(trim(COALESCE(NEW.documentation_url, ''))) = 0 OR
  length(trim(COALESCE(NEW.evidence_reference, ''))) = 0 OR
  NOT EXISTS (
    SELECT 1 FROM provider_registry p
    WHERE p.id = NEW.provider_id
      AND p.status IN ('VERIFIED', 'APPROVED', 'ENABLED')
      AND length(trim(COALESCE(p.rights_holder, ''))) > 0
      AND length(trim(COALESCE(p.license_reference, ''))) > 0
      AND length(trim(COALESCE(p.rights_evidence_url, ''))) > 0
      AND julianday(p.license_expires_at) > julianday('now')
  )
)
BEGIN
  SELECT RAISE(ABORT, 'connector cannot be approved without verified provider rights and evidence');
END;
