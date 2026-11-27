import test from "node:test";
import assert from "node:assert/strict";
import { onRequest } from "../functions/api/videos.js";
const request = (path = "/api/videos", method = "GET") => new Request("https://preview.example.test" + path, { method });
test("catalog explains empty state without contacting unapproved providers", async () => {
  let calls = 0; const originalFetch = globalThis.fetch; const originalCaches = globalThis.caches;
  globalThis.fetch = async () => { calls += 1; throw new Error("unexpected upstream call"); };
  globalThis.caches = { default: { match: async () => undefined, put: async () => undefined } };
  try {
    const response = await onRequest({ request: request(), env: {} }); const body = await response.json();
    assert.equal(response.status, 200); assert.equal(body.success, true);
    assert.equal(body.catalogState, "NO_APPROVED_PROVIDERS"); assert.equal(body.results.length, 0);
    assert.equal(body.providers.length, 5); assert.equal(body.providers.every(p => p.status === "NOT_CONFIGURED"), true);
    assert.equal(body.rightsGate.publicPlaybackEnabled, false); assert.equal(calls, 0);
    assert.match(body.message, /provider and per-title metadata rights have not been approved/i);
  } finally { globalThis.fetch = originalFetch; globalThis.caches = originalCaches; }
});
test("catalog validates pagination", async () => {
  const response = await onRequest({ request: request("/api/videos?page=0&limit=20"), env: {} });
  assert.equal(response.status, 400); assert.equal((await response.json()).code, "INVALID_PAGINATION");
});
test("catalog HEAD has no body", async () => {
  const response = await onRequest({ request: request("/api/videos", "HEAD"), env: {} });
  assert.equal(response.status, 200); assert.equal(await response.text(), "");
});
test("catalog page two is not sliced a second time after upstream pagination", async () => {
  const originalFetch = globalThis.fetch; const originalCaches = globalThis.caches;
  let requestedPage = "";
  const videoId = "42";
  const providerRights = { approved: true, enabled: true, rightsHolder: "Licensed Rights Holder", licenseReference: "LICENSE-1",
    evidenceUrl: "https://rights.example/provider.pdf", documentationUrl: "https://docs.example/api", expiresAt: "2099-12-31T23:59:59.000Z",
    regions: ["VN"], authMode: "none", playbackMode: "metadata_only" };
  const videoRights = { providerId: "souavzy", sourceContentId: videoId, approved: true, enabled: true, rightsHolder: "Licensed Rights Holder",
    licenseReference: "VIDEO-LICENSE-42", creator: "Verified Creator", sourceUrl: "https://source.example/video/42",
    evidenceUrl: "https://rights.example/video-42.pdf", expiresAt: "2099-12-31T23:59:59.000Z", sourceVerified: true,
    ownershipVerified: true, performerAgeVerified: true, performerConsentVerified: true, permittedUses: ["metadata_only"], regions: ["VN"] };
  globalThis.caches = { default: { match: async () => undefined, put: async () => undefined } };
  globalThis.fetch = async target => {
    const parsed = new URL(String(target)); requestedPage = parsed.searchParams.get("pg");
    return new Response(JSON.stringify({ code: 1, class: [], page: 2, pagecount: 2, total: 2, limit: 100,
      list: [{ vod_id: 42, vod_name: "Approved metadata fixture", type_id: 2, type_name: "Category", vod_pic: "https://images.example/poster.jpg" }] }),
      { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const env = { APPLECMS_SOUAVZY_URL: "https://api.souavzy.vip/api.php/provide/vod/",
      VIDEO_PROVIDER_RIGHTS_JSON: JSON.stringify({ souavzy: providerRights }),
      VIDEO_VIDEO_RIGHTS_JSON: JSON.stringify({ "souavzy:42": videoRights }) };
    const response = await onRequest({ request: request("/api/videos?page=2&limit=20"), env });
    const body = await response.json();
    assert.equal(response.status, 200); assert.equal(requestedPage, "2");
    assert.equal(body.results.length, 1); assert.equal(body.results[0].sourceContentId, videoId);
    assert.equal(body.hasMore, false);
  } finally { globalThis.fetch = originalFetch; globalThis.caches = originalCaches; }
});
