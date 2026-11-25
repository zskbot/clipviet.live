PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS provider_diagnostic_runs (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES provider_registry(id),
  status TEXT NOT NULL CHECK (status IN ('PASS','FAIL','UNVERIFIED')),
  result_json TEXT NOT NULL,
  checked_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_provider_diagnostic_runs_provider_checked
  ON provider_diagnostic_runs(provider_id, checked_at DESC);

-- Seed only known API endpoints. Empty rights evidence and media host lists are intentional.
-- These records remain PENDING until independent technical and legal review.
INSERT OR IGNORE INTO provider_registry
(id,name,status,api_base_url,api_host,media_hosts_json,rights_holder,license_reference,rights_evidence_url,license_expires_at,created_at,updated_at,last_event_id)
VALUES
('souavzy','Souavzy · Main','PENDING','https://api.souavzy.vip/api.php/provide/vod/','api.souavzy.vip','[]','','','','','2026-11-25T00:00:00.000Z','2026-11-25T00:00:00.000Z','seed-souavzy'),
('apiyutu','ApiYutu · Backup 1','PENDING','https://apiyutu.com/api.php/provide/vod/','apiyutu.com','[]','','','','','2026-11-25T00:00:00.000Z','2026-11-25T00:00:00.000Z','seed-apiyutu'),
('lbapi9','LBApi9 · Backup 2','PENDING','https://lbapi9.com/api.php/provide/vod/','lbapi9.com','[]','','','','','2026-11-25T00:00:00.000Z','2026-11-25T00:00:00.000Z','seed-lbapi9'),
('slapibf','Slapibf · Backup 3','PENDING','https://slapibf.com/api.php/provide/vod/','slapibf.com','[]','','','','','2026-11-25T00:00:00.000Z','2026-11-25T00:00:00.000Z','seed-slapibf'),
('jipinvip1','JipinVIP1 · Backup 4','PENDING','https://jipinvip1.com/api.php/provide/vod/','jipinvip1.com','[]','','','','','2026-11-25T00:00:00.000Z','2026-11-25T00:00:00.000Z','seed-jipinvip1');

INSERT OR IGNORE INTO provider_audit
(event_id,provider_id,action,from_status,to_status,actor_role,metadata_json,created_at)
VALUES
('seed-souavzy','souavzy','PROVIDER_SEEDED',NULL,'PENDING','admin','{"source":"known_config","rights":"not_verified","media_hosts":"empty"}','2026-11-25T00:00:00.000Z'),
('seed-apiyutu','apiyutu','PROVIDER_SEEDED',NULL,'PENDING','admin','{"source":"known_config","rights":"not_verified","media_hosts":"empty"}','2026-11-25T00:00:00.000Z'),
('seed-lbapi9','lbapi9','PROVIDER_SEEDED',NULL,'PENDING','admin','{"source":"known_config","rights":"not_verified","media_hosts":"empty"}','2026-11-25T00:00:00.000Z'),
('seed-slapibf','slapibf','PROVIDER_SEEDED',NULL,'PENDING','admin','{"source":"known_config","rights":"not_verified","media_hosts":"empty"}','2026-11-25T00:00:00.000Z'),
('seed-jipinvip1','jipinvip1','PROVIDER_SEEDED',NULL,'PENDING','admin','{"source":"known_config","rights":"not_verified","media_hosts":"empty"}','2026-11-25T00:00:00.000Z');
