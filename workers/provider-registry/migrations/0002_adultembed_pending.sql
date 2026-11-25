-- Seed AdultEmbed as PENDING only. This migration does not create credentials,
-- attest to distribution rights, or enable any public playback.
INSERT OR IGNORE INTO provider_registry (
  id, name, status, api_base_url, api_host, media_hosts_json,
  rights_holder, license_reference, rights_evidence_url, license_expires_at,
  api_credential_ciphertext, technical_evidence_json, legal_evidence_json,
  created_at, updated_at, last_event_id
) VALUES (
  'adultembed',
  'AdultEmbed',
  'PENDING',
  'https://adultembed.com/api/v1/',
  'adultembed.com',
  '[]',
  '',
  '',
  '',
  '',
  NULL,
  NULL,
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  'seed-adultembed-pending-20261124'
);

INSERT OR IGNORE INTO provider_audit (
  event_id, provider_id, action, from_status, to_status,
  actor_role, metadata_json, created_at
) VALUES (
  'seed-adultembed-pending-20261124',
  'adultembed',
  'PROVIDER_REGISTERED_PENDING',
  NULL,
  'PENDING',
  'admin',
  '{"rightsEvidenceProvided":false,"distributionRightsVerified":false,"publicPlaybackEnabled":false}',
  CURRENT_TIMESTAMP
);
