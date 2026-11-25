import test from "node:test";
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
