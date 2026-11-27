import test from "node:test";
import assert from "node:assert/strict";
import { onRequest } from "../functions/api/videos.js";
const request = (path = "/api/videos", method = "GET") => new Request("https://preview.example.test" + path, { method });
test("catalog explains rights-pending empty state without contacting providers", async () => {
  let calls = 0; const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { calls += 1; throw new Error("unexpected upstream call"); };
  try {
    const response = await onRequest({ request: request(), env: {} });
    const body = await response.json();
    assert.equal(response.status, 200); assert.equal(body.success, true);
    assert.equal(body.catalogState, "NO_APPROVED_PROVIDERS"); assert.equal(body.results.length, 0);
    assert.equal(body.providers.length, 5); assert.equal(body.providers.every(p => p.status === "NOT_CONFIGURED"), true);
    assert.equal(body.rightsGate.publicPlaybackEnabled, false); assert.equal(calls, 0);
    assert.match(body.message, /provider and per-title metadata rights have not been approved/i);
  } finally { globalThis.fetch = originalFetch; }
});
test("catalog validates pagination", async () => {
  const response = await onRequest({ request: request("/api/videos?page=0&limit=20"), env: {} });
  assert.equal(response.status, 400); assert.equal((await response.json()).code, "INVALID_PAGINATION");
});
test("catalog HEAD has no body", async () => {
  const response = await onRequest({ request: request("/api/videos", "HEAD"), env: {} });
  assert.equal(response.status, 200); assert.equal(await response.text(), "");
});
