import test from "node:test";
import assert from "node:assert/strict";
import { parsePlayUrls, getProviderCategories, listProviderVideos } from "./applecms.js";

const providerApproval = {
  provider_status: "APPROVED",
  rights_holder: "ClipViet test fixture",
  license_reference: "TEST-PROVIDER-LICENSE",
  rights_evidence_url: "https://rights.example/provider-evidence",
  license_expires_at: "2099-12-31T23:59:59.000Z",
  connector_status: "APPROVED",
  playback_mode: "metadata_only",
  regions_json: '["VN"]'
};

const contentApproval = {
  source_content_id: "7",
  source_url: "https://api.souavzy.vip/source/7",
  rights_holder: "ClipViet test fixture",
  license_reference: "TEST-CONTENT-LICENSE-7",
  evidence_url: "https://rights.example/content/7",
  license_expires_at: "2099-12-31T23:59:59.000Z",
  permitted_uses_json: '["metadata_only"]',
  regions_json: '["VN"]',
  source_verified: 1,
  ownership_verified: 1,
  performer_age_verified: 1,
  performer_consent_verified: 1
};

function makeEnv(contentRows = []) {
  return {
    APPLECMS_SOUAVZY_URL: "https://api.souavzy.vip/api.php/provide/vod/",
    PROVIDER_DB: {
      prepare(sql) {
        return {
          bind() {
            return {
              first: async () => providerApproval,
              all: async () => ({ results: sql.includes("provider_content_rights") ? contentRows : [] })
            };
          }
        };
      }
    }
  };
}

test("AppleCMS parser preserves dollar signs inside playback URLs", () => {
  const lines = parsePlayUrls(
    "HD$https://cdn.example/video.m3u8#Episode$Special$https://cdn.example/2.m3u8$$$Backup$https://backup.example/1.m3u8",
    "Primary$$$Backup"
  );
  assert.equal(lines.length, 2);
  assert.equal(lines[0].lineName, "Primary");
  assert.equal(lines[0].episodes[0].url, "https://cdn.example/video.m3u8");
  assert.equal(lines[0].episodes[1].name, "Episode$Special");
  assert.equal(lines[1].lineName, "Backup");
});

test("category adapter filters parent categories and keeps leaf categories", async () => {
  const originalFetch = globalThis.fetch;
  const originalCaches = globalThis.caches;
  globalThis.caches = { default: { match: async () => null, put: async () => {} } };
  globalThis.fetch = async () => new Response(JSON.stringify({
    code: 1,
    class: [
      { type_id: 10, type_pid: 0, type_name: "Parent" },
      { type_id: 11, type_pid: 10, type_name: "Leaf A" },
      { type_id: 12, type_pid: 10, type_name: "Leaf B" },
      { type_id: 20, type_pid: 0, type_name: "Standalone" }
    ]
  }), { status: 200, headers: { "content-type": "application/json" } });
  try {
    const categories = await getProviderCategories("souavzy", makeEnv());
    assert.deepEqual(categories.map(item => item.id), [11, 12, 20]);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.caches = originalCaches;
  }
});

test("list adapter respects approved registry pagination and never returns unapproved playback URLs", async () => {
  const originalFetch = globalThis.fetch;
  const originalCaches = globalThis.caches;
  globalThis.caches = { default: { match: async () => null, put: async () => {} } };
  globalThis.fetch = async () => new Response(JSON.stringify({
    code: 1,
    list: [{
      vod_id: 7,
      vod_name: "Approved metadata sample",
      vod_pic: "https://img.example/poster.jpg",
      vod_content: "",
      vod_blurb: "Fallback description",
      vod_play_from: "HD",
      vod_play_url: "Episode$https://cdn.example/index.m3u8"
    }]
  }), { status: 200, headers: { "content-type": "application/json" } });
  try {
    const result = await listProviderVideos("souavzy", { page: 1 }, makeEnv([contentApproval]));
    assert.equal(result.page, 1);
    assert.equal(result.pageCount, 1);
    assert.equal(result.limit, 30);
    assert.equal(result.total, 1);
    assert.equal(result.items[0].uid, "souavzy:7");
    assert.equal(result.items[0].description, "Fallback description");
    assert.deepEqual(result.items[0].lines, []);
    assert.equal(result.items[0].playbackEnabled, false);
    assert.equal(result.rightsGate.playbackEnabled, false);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.caches = originalCaches;
  }
});

test("provider URL is constrained to the approved HTTPS host and path", async () => {
  const badEnv = { APPLECMS_SOUAVZY_URL: "https://evil.example/api.php/provide/vod/" };
  await assert.rejects(() => getProviderCategories("souavzy", badEnv), error => error.status === 503);
});
