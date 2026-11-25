import test from "node:test";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { adminPage } from "../workers/provider-registry/src/admin-ui.mjs";

test("Preview admin console is mobile-first, same-origin and does not depend on external assets", async () => {
  const response = adminPage();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /text\/html/);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.match(response.headers.get("content-security-policy"), /connect-src 'self'/);
  const html = await response.text();
  assert.match(html, /name="viewport"/);
  assert.match(html, /RUN DIAGNOSTIC/);
  assert.match(html, /\/health/);
  assert.match(html, /\/providers/);
  assert.match(html, /credentials:"same-origin"/);
  assert.match(html, /All seeded providers remain PENDING/);
  assert.doesNotMatch(html, /https?:\/\/[^"' ]+\.(?:js|css)/);
});


test("static admin workspace stays locked until the catalog Worker validates a session", async () => {
  const [script, page] = await Promise.all([
    readFile(new URL("../site/admin/admin.js", import.meta.url), "utf8"),
    readFile(new URL("../site/admin/index.html", import.meta.url), "utf8")
  ]);
  assert.match(page, /id="admin-login-gate"/);
  assert.match(page, /id="admin-workspace" data-admin-protected inert aria-disabled="true"/);
  assert.match(script, /\/api\/admin\/session/);
  assert.match(script, /\/api\/admin\/login/);
  assert.match(script, /sessionStorage\.setItem\(ADMIN_SESSION_KEY, adminToken\)/);
  assert.match(script, /node\.inert = !allowed/);
  assert.doesNotMatch(script, /setAdminAccess\(true, "Admin workspace đã mở\."/);
});
