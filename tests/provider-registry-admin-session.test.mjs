import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import registryWorker from "../workers/provider-registry/src/rights-entry.mjs";

globalThis.crypto ??= webcrypto;
const origin = "https://clipviet-provider-registry-preview.account.workers.dev";
const env = { REGISTRY_ENV: "preview" };

function dbFor(session = null, intakes = []) {
  return {
    prepare(sql) {
      return {
        bind() { return this; },
        async first() {
          if (sql.includes("FROM auth_sessions")) return session;
          return null;
        },
        async all() {
          if (sql.includes("FROM provider_metadata_intake")) return { results: intakes };
          return { results: [] };
        }
      };
    }
  };
}

test("Gmail/password session unlocks the Provider Registry Admin page", async () => {
  const expired = new Date(Date.now() + 60_000).toISOString();
  const response = await registryWorker.fetch(new Request(origin + "/admin", {
    headers: { cookie: "cv_session=opaque-session-token" }
  }), { ...env, PROVIDER_DB: dbFor({ role: "admin", active: 1, expires_at: expired }) }, {});
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /text\/html/);
  assert.match(await response.text(), /Provider Diagnostics/);
});

test("Registry Admin redirects to login without a valid D1 session", async () => {
  const response = await registryWorker.fetch(new Request(origin + "/admin"), {
    ...env, PROVIDER_DB: dbFor(null)
  }, {});
  assert.equal(response.status, 302);
  assert.equal(response.headers.get("location"), origin + "/login");
});

test("Registry login route remains Preview-only", async () => {
  const response = await registryWorker.fetch(new Request("https://clipviet.live/login"), {
    ...env, PROVIDER_DB: dbFor()
  }, {});
  assert.equal(response.status, 404);
});

test("Admin session can read the metadata intake queue without changing its status", async () => {
  const expires = new Date(Date.now() + 60_000).toISOString();
  const records = [{
    id: "intake-1", provider_id: "souavzy", provider_name: "Souavzy",
    api_host: "api.souavzy.vip", api_base_url: "https://api.souavzy.vip/api.php/provide/vod/",
    rights_holder: "Rights Holder Ltd", license_reference: "LIC-2026-001",
    evidence_url: "https://rights.example/license", documentation_url: "https://docs.example/api",
    license_expires_at: "2027-12-31T00:00:00.000Z", regions_json: "[\\"VN\\"]",
    contact_email: "legal@example.com", note: "Metadata-only review",
    status: "PENDING_REVIEW", created_at: "2026-11-28T00:00:00.000Z",
    updated_at: "2026-11-28T00:00:00.000Z"
  }];
  const response = await registryWorker.fetch(new Request(origin + "/metadata-intakes", {
    headers: { cookie: "cv_session=opaque-session-token" }
  }), { ...env, PROVIDER_DB: dbFor({ role: "admin", active: 1, expires_at: expires }, records) }, {});
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.count, 1);
  assert.equal(payload.pendingReview, 1);
  assert.equal(payload.intakes[0].status, "PENDING_REVIEW");
  assert.equal(payload.intakes[0].providerId, "souavzy");
});

test("Technical-only role cannot read metadata intake evidence", async () => {
  const response = await registryWorker.fetch(new Request(origin + "/metadata-intakes", {
    headers: { authorization: "Bearer technical-secret" }
  }), { ...env, REGISTRY_TECH_TOKEN: "technical-secret", PROVIDER_DB: dbFor() }, {});
  assert.equal(response.status, 403);
});
