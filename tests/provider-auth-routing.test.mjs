import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import worker from "../workers/provider-registry/src/index.mjs";

globalThis.crypto ??= webcrypto;

function fakeDb({ user = null } = {}) {
  return {
    prepare(sql) {
      return {
        bind() { return this; },
        async first() {
          if (sql.includes("COUNT(*) AS count FROM auth_users")) return { count: user ? 1 : 0 };
          if (sql.includes("FROM auth_sessions")) return user;
          return null;
        }
      };
    }
  };
}

const base = "https://clipviet-provider-registry-preview.account.workers.dev";
const env = db => ({ REGISTRY_ENV: "preview", PROVIDER_DB: db });

test("Preview Worker routes Gmail/password login and auth status before protected APIs", async () => {
  const db = fakeDb();
  const login = await worker.fetch(new Request(base + "/login"), env(db), {});
  assert.equal(login.status, 200);
  assert.match(login.headers.get("content-type"), /text\/html/);
  const html = await login.text();
  assert.match(html, /Gmail/i);
  assert.match(html, /password/i);

  const status = await worker.fetch(new Request(base + "/auth/status"), env(db), {});
  assert.equal(status.status, 200);
  assert.deepEqual(await status.json(), { setupRequired: true });

  const me = await worker.fetch(new Request(base + "/auth/me"), env(db), {});
  assert.equal(me.status, 401);
  assert.deepEqual(await me.json(), { authenticated: false });
});

test("Preview Worker keeps Admin console behind a valid server-side session", async () => {
  const expired = new Date(Date.now() + 60_000).toISOString();
  const db = fakeDb({ user: { role: "admin", active: 1, expires_at: expired } });
  const noSession = await worker.fetch(new Request(base + "/admin"), env(db), {});
  assert.equal(noSession.status, 302);
  assert.equal(noSession.headers.get("location"), base + "/login");

  const withSession = await worker.fetch(new Request(base + "/admin", {
    headers: { cookie: "cv_session=opaque-preview-session" }
  }), env(db), {});
  assert.equal(withSession.status, 200);
  assert.match(await withSession.text(), /Provider Diagnostics/);
});

test("Preview Worker refuses the email/password routes outside the dedicated Preview host", async () => {
  const response = await worker.fetch(new Request("https://clipviet.live/login"), env(fakeDb()), {});
  assert.equal(response.status, 404);
});
