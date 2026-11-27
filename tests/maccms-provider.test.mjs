import test from "node:test";
import assert from "node:assert/strict";
import { parseMacCmsPlayUrl, normalizeMacCmsItem, getMacCmsFeed } from "../lib/maccms-provider.mjs";

test("MacCMS play URL parser handles routes and episodes with last dollar separator", () => {
  const items = parseMacCmsPlayUrl("HD$https://cdn.example.com/a.m3u8#Tập 2$https://cdn.example.com/b.mp4$$$Backup$https://cdn.example.com/c.mp4");
  assert.deepEqual(items.map(item => item.label), ["HD", "Tập 2", "Backup"]);
  assert.equal(items[1].url, "https://cdn.example.com/b.mp4");
  assert.equal(items[2].routeIndex, 1);
});


test("MacCMS parser preserves dollar signs inside the media URL and fills an empty episode label", () => {
  const [item] = parseMacCmsPlayUrl("$https://cdn.example.com/video$token.m3u8");
  assert.equal(item.label, "Tập 1");
  assert.equal(item.url, "https://cdn.example.com/video$token.m3u8");
});

test("MacCMS providers are opt-in; no unreviewed source is contacted by default", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; throw new Error("unexpected upstream request"); };
  try {
    const result = await getMacCmsFeed({});
    assert.deepEqual(result.results, []);
    assert.deepEqual(result.providers, []);
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("MacCMS parser ignores malformed and non-HTTPS playback URLs", () => {
  assert.deepEqual(parseMacCmsPlayUrl("bad-entry#NoUrl$http://cdn.example.com/a.mp4"), []);
});

test("MacCMS list item maps provider metadata and only allows configured media hosts", () => {
  const item = normalizeMacCmsItem({
    vod_id: 123,
    vod_name: "Video title",
    type_name: "JAV",
    vod_year: "2025",
    vod_pic: "https://images.example.com/poster.jpg",
    vod_play_url: "HD$https://media.example.com/video.m3u8"
  }, { id: "test", name: "Test provider" });
  assert.equal(item.id, "maccms:test:123");
  assert.equal(item.category, "JAV");
  assert.equal(item.videoUrl, "");
});


test("MacCMS video feed uses ac=list and preserves provider pagination metadata", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl;
  globalThis.fetch = async (input) => {
    requestedUrl = new URL(String(input));
    return new Response(JSON.stringify({
      code: 1, page: 1, pagecount: 3, total: 240, limit: 100,
      list: [{
        vod_id: 42, vod_name: "Fixture video", type_name: "Fixture category",
        vod_year: "2026", vod_play_url: "HLS$https://media.example.test/fixture.m3u8"
      }]
    }), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const env = {
      VIDEO_MACCMS_PROVIDERS_JSON: JSON.stringify([{
        id: "souavzy", name: "Souavzy Main",
        apiUrl: "https://api.souavzy.vip/api.php/provide/vod/"
      }]),
      VIDEO_API_ALLOWED_HOSTS: "api.souavzy.vip",
      VIDEO_MEDIA_ALLOWED_HOSTS: "media.example.test",
      VIDEO_PROVIDER_RIGHTS_JSON: JSON.stringify({
        "maccms:souavzy": {
          approved: true,
          enabled: true,
          rightsHolder: "Test rights holder",
          licenseReference: "TEST-LICENSE-001",
          evidenceUrl: "https://rights.example.test/provider-evidence",
          documentationUrl: "https://rights.example.test/provider-docs",
          expiresAt: "2099-01-01T00:00:00.000Z",
          authMode: "none",
          playbackMode: "owner_hosted_stream",
          regions: ["VN"]
        }
      }),
      VIDEO_VIDEO_RIGHTS_JSON: JSON.stringify({
        "maccms:souavzy:42": {
          providerId: "maccms:souavzy",
          approved: true,
          enabled: true,
          rightsHolder: "Test rights holder",
          licenseReference: "TEST-LICENSE-001",
          creator: "Test creator",
          sourceContentId: "42",
          sourceUrl: "https://api.souavzy.vip/video/42",
          evidenceUrl: "https://rights.example.test/video-evidence/42",
          expiresAt: "2099-01-01T00:00:00.000Z",
          sourceVerified: true,
          ownershipVerified: true,
          performerAgeVerified: true,
          performerConsentVerified: true,
          permittedUses: ["metadata_only", "owner_hosted_stream"],
          regions: ["VN"]
        }
      })
    };
    const result = await getMacCmsFeed(env);
    assert.equal(requestedUrl.searchParams.get("ac"), "list");
    assert.equal(requestedUrl.searchParams.get("pg"), "1");
    assert.equal(requestedUrl.searchParams.get("pagesize"), "100");
    assert.equal(result.results.length, 1);
    assert.equal(result.results[0].title, "Fixture video");
    assert.equal(result.results[0].videoUrl, "https://media.example.test/fixture.m3u8");
    assert.deepEqual(result.providers[0], {
      id: "souavzy", name: "Souavzy Main", count: 1,
      page: 1, pageCount: 3, total: 240, limit: 100, state: "ok"
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
