import test from "node:test";
import assert from "node:assert/strict";
import { parseCsv, normalizeRecord, buildImportPlan } from "../scripts/import-licensed-catalog.mjs";

const valid = {
  id: "licensed-001",
  title: "Licensed video",
  media_url: "https://media.example.org/video.mp4",
  source_url: "https://publisher.example.org/watch/1",
  rights_holder: "Example Publisher",
  license_reference: "LIC-2026-001",
  rights_evidence_url: "https://publisher.example.org/licenses/LIC-2026-001.pdf",
  license_expires_at: "2030-12-31T23:59:59Z",
  playback_allowed: "true"
};

test("CSV parser handles quoted commas, escaped quotes, and newlines", () => {
  const rows = parseCsv('id,title,description\n1,"A, title","line one\nline ""two"""\n');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].title, "A, title");
  assert.equal(rows[0].description, 'line one\nline "two"');
});

test("licensed records remain pending manual review and never publish", () => {
  const record = normalizeRecord(valid, { allowedHosts: ["example.org"], now: "2026-01-01T00:00:00Z" });
  assert.equal(record.importStatus, "READY_FOR_MANUAL_REVIEW");
  assert.equal(record.rights.status, "PENDING_REVIEW");
  assert.equal(record.mediaUrl, valid.media_url);
});

test("missing rights evidence quarantines the record and strips media URL", () => {
  const record = normalizeRecord({ ...valid, rights_evidence_url: "" }, { allowedHosts: ["example.org"], now: "2026-01-01T00:00:00Z" });
  assert.equal(record.importStatus, "QUARANTINED");
  assert.equal(record.mediaUrl, null);
  assert.ok(record.quarantineReasons.includes("HTTPS_RIGHTS_EVIDENCE_REQUIRED"));
});

test("expired license is quarantined", () => {
  const record = normalizeRecord({ ...valid, license_expires_at: "2020-01-01T00:00:00Z" }, { allowedHosts: ["example.org"], now: "2026-01-01T00:00:00Z" });
  assert.ok(record.quarantineReasons.includes("LICENSE_EXPIRY_INVALID_OR_EXPIRED"));
});

test("media hosts must be explicitly allowlisted", () => {
  const record = normalizeRecord(valid, { allowedHosts: ["cdn.example.net"], now: "2026-01-01T00:00:00Z" });
  assert.ok(record.quarantineReasons.includes("MEDIA_HOST_NOT_ALLOWLISTED"));
  assert.equal(record.mediaUrl, null);
});

test("plan deduplicates IDs and chunks at the configured batch size", () => {
  const rows = Array.from({ length: 7 }, (_, index) => ({ ...valid, id: "id-" + index }));
  rows.push({ ...valid, id: "id-0" });
  const plan = buildImportPlan(rows, { allowedHosts: ["example.org"], batchSize: 3, now: "2026-01-01T00:00:00Z" });
  assert.equal(plan.uniqueCount, 7);
  assert.equal(plan.duplicateCount, 1);
  assert.deepEqual(plan.batches.map(batch => batch.records.length), [3, 3, 1]);
  assert.equal(plan.published, 0);
  assert.equal(plan.playbackEnabled, 0);
});
