import test from "node:test";
import assert from "node:assert/strict";
import { onRequest } from "../functions/api/providers/applecms/diagnostics.js";
test("diagnostics do not contact providers before rights approval", async () => {
  const originalFetch = globalThis.fetch; const originalCaches = globalThis.caches; let calls = 0;
  globalThis.fetch = async () => { calls += 1; throw new Error("must not call"); };
  globalThis.caches = { default: { match: async () => undefined, put: async () => undefined } };
  try {
    const response = await onRequest({ request: new Request("https://preview.test/api/providers/applecms/diagnostics"), env: {
      APPLECMS_SOUAVZY_URL: "https://api.souavzy.vip/api.php/provide/vod/"
    } });
    const body = await response.json();
    assert.equal(response.status, 200); assert.equal(body.summary.pendingRights, 1);
    assert.equal(body.providers.find(item => item.id === "souavzy").diagnostic, "PENDING_RIGHTS");
    assert.equal(calls, 0);
  } finally { globalThis.fetch = originalFetch; globalThis.caches = originalCaches; }
});
