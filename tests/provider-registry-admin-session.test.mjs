import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import registryWorker from "../workers/provider-registry/src/rights-entry.mjs";

globalThis.crypto ??= webcrypto;
const origin = "https://clipviet-provider-registry-preview.account.workers.dev";
const env = { REGISTRY_ENV: "preview" };

function dbFor(session = null) {
  return {
    prepare(sql) {
      return {
        bind() { return this; },
        async first() {
          if (sql.includes("FROM auth_sessions")) return session;
          return null;
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
