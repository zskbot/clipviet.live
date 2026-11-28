import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("provider rights migration installs provider and external-source INSERT/UPDATE guards", async () => {
  const sql = await readFile(new URL("../workers/provider-registry/migrations/0007_provider_registry_rights_guards.sql", import.meta.url), "utf8");
  for (const trigger of [
    "trg_provider_registry_enable_guard_insert",
    "trg_provider_registry_enable_guard_update",
    "trg_external_source_playback_guard_insert",
    "trg_external_source_playback_guard_update"
  ]) assert.ok(sql.includes(trigger), `missing trigger: ${trigger}`);
  assert.equal((sql.match(/CREATE TRIGGER IF NOT EXISTS/g) || []).length, 4);
  assert.match(sql, /RAISE\(ABORT/);
  assert.match(sql, /julianday\(NEW\.license_expires_at\) <= julianday\('now'\)/);
  assert.match(sql, /NEW\.playback_enabled = 1/);
  assert.match(sql, /INSERT OR IGNORE INTO schema_migrations/);
});
