import test from "node:test";
import assert from "node:assert/strict";
import { onRequest as status } from "../functions/api/providers/applecms/status.js";
import { onRequest as categories } from "../functions/api/providers/applecms/categories.js";
import { onRequest as videos } from "../functions/api/providers/applecms/videos.js";
import { onRequest as detail } from "../functions/api/providers/applecms/videos/[id].js";
import { onRequest as playback } from "../functions/api/providers/applecms/videos/[id]/playback.js";

const sourceId = "souavzy";
const apiUrl = "https://api.souavzy.vip/api.php/provide/vod/";
const validProviderRights = (playbackMode = "metadata_only", extra = {}) => ({
  approved: true, enabled: true, rightsHolder: "Licensed Rights Holder",
  licenseReference: "TEST-LICENSE-2026", evidenceUrl: "https://rights.example/provider.pdf",
  documentationUrl: "https://docs.example/api", expiresAt: "2099-12-31T23:59:59.000Z",
  regions: ["VN"], authMode: "none", playbackMode, ...extra
});
const validVideoRights = (permittedUses = ["metadata_only"], extra = {}) => ({
  providerId: sourceId, sourceContentId: "42", approved: true, enabled: true,
  rightsHolder: "Licensed Rights Holder", licenseReference: "TEST-VIDEO-42",
  creator: "Verified Creator", sourceUrl: "https://source.example/video/42",
  evidenceUrl: "https://rights.example/video-42.pdf", expiresAt: "2099-12-31T23:59:59.000Z",
  sourceVerified: true, ownershipVerified: true, performerAgeVerified: true,
  performerConsentVerified: true, permittedUses, regions: ["VN"], ...extra
});
const providerEnv = (playbackMode = "metadata_only", videoUses = ["metadata_only"], extraRights = {}) => ({
  APPLECMS_SOUAVZY_URL: apiUrl,
  VIDEO_PROVIDER_RIGHTS_JSON: JSON.stringify({ [sourceId]: validProviderRights(playbackMode, extraRights) }),
  VIDEO_VIDEO_RIGHTS_JSON: JSON.stringify({ [sourceId + ":42"]: validVideoRights(videoUses) })
});
const fixture = {
  code: 1, page: 1, pagecount: 1, total: 1, limit: 1,
  class: [{ type_id: 1, type_pid: 0, type_name: "Root" }, { type_id: 2, type_pid: 1, type_name: "Category" }],
  list: [{
    vod_id: 42, vod_name: "Licensed Test Fixture", type_id: 2, type_name: "Category",
    vod_pic: "https://images.example/poster.jpg", vod_play_from: "Test line",
    vod_play_url: "Episode 1$https://media.example/fixture.m3u8",
    vod_embed: "https://player.example/embed/42"
  }]
};
function setupFetch() {
  const originalFetch = globalThis.fetch;
  const originalCaches = globalThis.caches;
  let calls = 0;
  globalThis.caches = { default: { match: async () => undefined, put: async () => undefined } };
  globalThis.fetch = async (url) => {
    calls += 1;
    const target = new URL(String(url));
    const body = target.searchParams.get("ac") === "list"
      ? { code: 1, class: fixture.class, list: [] }
      : { code: 1, page: 1, pagecount: 1, total: 1, limit: 1, list: fixture.list };
    return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  };
  return { calls: () => calls, restore: () => { globalThis.fetch = originalFetch; globalThis.caches = originalCaches; } };
}
const request = (path, method = "GET") => new Request("https://preview.example.test" + path, { method });

test("status lists five providers and distinguishes pending rights from health checks", async () => {
  const response = await status({ request: request("/api/providers/applecms/status"), env: { APPLECMS_SOUAVZY_URL: apiUrl } });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.providers.length, 5);
  assert.equal(body.providers.find(item => item.id === sourceId).status, "PENDING_RIGHTS");
  assert.equal(body.providers.find(item => item.id === sourceId).operationalState, "NOT_CHECKED");
  assert.equal(body.rightsGate.playbackEnabled, false);
});

test("provider endpoints fail closed before any upstream request without a rights record", async () => {
  const mock = setupFetch();
  try {
    const response = await categories({ request: request("/api/providers/applecms/categories?sourceId=souavzy"), env: { APPLECMS_SOUAVZY_URL: apiUrl } });
    const body = await response.json();
    assert.equal(response.status, 403);
    assert.equal(body.code, "PROVIDER_RIGHTS_PENDING");
    assert.equal(mock.calls(), 0);
  } finally { mock.restore(); }
});

test("category endpoint returns normalized leaf categories after provider approval", async () => {
  const mock = setupFetch();
  try {
    const response = await categories({ request: request("/api/providers/applecms/categories?sourceId=souavzy"), env: providerEnv() });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.deepEqual(body.categories, [{ id: "2", parentId: "1", name: "Category" }]);
    assert.equal(body.provider.status, "METADATA_ONLY");
    assert.equal(body.provider.operationalState, "ACTIVE");
  } finally { mock.restore(); }
});

test("video list and detail never disclose upstream HLS or embed URLs", async () => {
  const mock = setupFetch();
  try {
    const env = providerEnv();
    const listed = await videos({ request: request("/api/providers/applecms/videos?sourceId=souavzy&page=1"), env });
    const listBody = await listed.json();
    assert.equal(listed.status, 200);
    assert.equal(listBody.items.length, 1);
    assert.equal(listBody.items[0].playbackEnabled, false);
    assert.equal(listBody.items[0].playbackRightsApproved, false);
    assert.equal(JSON.stringify(listBody).includes("fixture.m3u8"), false);
    assert.equal(JSON.stringify(listBody).includes("player.example"), false);

    const detailed = await detail({ request: request("/api/providers/applecms/videos/42?sourceId=souavzy"), env, params: { id: "42" } });
    const detailBody = await detailed.json();
    assert.equal(detailed.status, 200);
    assert.equal(detailBody.data.title, "Licensed Test Fixture");
    assert.equal(detailBody.playback.enabled, false);
    assert.equal(JSON.stringify(detailBody).includes("fixture.m3u8"), false);
  } finally { mock.restore(); }
});

test("metadata-only provider cannot use the playback endpoint", async () => {
  const mock = setupFetch();
  try {
    const response = await playback({
      request: request("/api/providers/applecms/videos/42/playback?sourceId=souavzy"),
      env: providerEnv("metadata_only", ["metadata_only"]), params: { id: "42" }
    });
    const body = await response.json();
    assert.equal(response.status, 403);
    assert.equal(body.code, "PLAYBACK_RIGHTS_PENDING");
    assert.equal(JSON.stringify(body).includes("fixture.m3u8"), false);
  } finally { mock.restore(); }
});

test("owner-hosted stream is returned only for per-video approval and an exact allowlisted host", async () => {
  const mock = setupFetch();
  try {
    const env = providerEnv("owner_hosted_stream", ["metadata_only", "owner_hosted_stream"], { mediaHosts: ["media.example"] });
    const response = await playback({
      request: request("/api/providers/applecms/videos/42/playback?sourceId=souavzy"),
      env, params: { id: "42" }
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.data.delivery, "direct-browser");
    assert.equal(body.data.sources[0].episodes[0].url, "https://media.example/fixture.m3u8");

    const denied = await playback({
      request: request("/api/providers/applecms/videos/42/playback?sourceId=souavzy"),
      env: { ...env, VIDEO_PROVIDER_RIGHTS_JSON: JSON.stringify({ souavzy: validProviderRights("owner_hosted_stream", { mediaHosts: [] }) }) },
      params: { id: "42" }
    });
    assert.equal(denied.status, 403);
    assert.equal((await denied.json()).code, "MEDIA_HOST_NOT_APPROVED");
  } finally { mock.restore(); }
});

test("official embed mode returns only a separately supplied embed URL from the exact allowlist", async () => {
  const mock = setupFetch();
  try {
    const env = providerEnv("official_embed", ["metadata_only", "official_embed"], { embedHosts: ["player.example"] });
    const response = await playback({
      request: request("/api/providers/applecms/videos/42/playback?sourceId=souavzy"),
      env, params: { id: "42" }
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.data.playbackMode, "official_embed");
    assert.equal(body.data.sources[0].url, "https://player.example/embed/42");
    assert.equal(JSON.stringify(body).includes("fixture.m3u8"), false);
  } finally { mock.restore(); }
});

test("legacy unguarded endpoint is permanently disabled", async () => {
  const { onRequest } = await import("../functions/api/video-detail.js");
  const response = await onRequest({ request: request("/api/video-detail?sourceId=souavzy&vodId=42"), env: providerEnv("owner_hosted_stream", ["metadata_only", "owner_hosted_stream"]) });
  assert.equal(response.status, 410);
  assert.equal((await response.json()).code, "LEGACY_PLAYBACK_ENDPOINT_DISABLED");
});

import { onRequest as rootStatus } from "../functions/api/providers/applecms.js";

test("legacy AppleCMS root route returns provider states without a missing metadata export", async () => {
  const response = await rootStatus({
    request: request("/api/providers/applecms"),
    env: { APPLECMS_SOUAVZY_URL: apiUrl }
  });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.providers.length, 5);
  assert.equal(body.providers.find(item => item.id === sourceId).status, "PENDING_RIGHTS");
  assert.equal(body.rightsGate.playbackEnabled, false);
  assert.equal(JSON.stringify(body).includes("fixture.m3u8"), false);
});
