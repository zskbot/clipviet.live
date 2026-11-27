import test from "node:test";
import assert from "node:assert/strict";
import { parsePlayUrls, getProviderCategories, listProviderVideos } from "./applecms.js";

const future = "2099-01-01T00:00:00.000Z";
const providerDb = {
  prepare(sql) {
    return {
      bind() {
        if (sql.includes("FROM provider_registry")) {
          return {
            first: async () => ({
              provider_status: "APPROVED",
              rights_holder: "Test rights holder",
              license_reference: "TEST-LICENSE-001",
              rights_evidence_url: "https://rights.example/evidence",
              license_expires_at: future,
              connector_status: "APPROVED",
              playback_mode: "metadata_only",
              regions_json: '["VN"]'
            })
          };
        }
        if (sql.includes("FROM provider_content_rights")) {
          return {
            all: async () => ({
              results: [{
                source_content_id: "7",
                source_url: "https://api.souavzy.vip/item/7",
                rights_holder: "Test rights holder",
                license_reference: "TEST-LICENSE-001",
                evidence_url: "https://rights.example/item/7",
                license_expires_at: future,
                permitted_uses_json: '["metadata_only"]',
                regions_json: '["VN"]',
                source_verified: 1,
                ownership_verified: 1,
                performer_age_verified: 1,
                performer_consent_verified: 1
              }]
            })
          };
        }
        throw new Error("Unexpected rights registry query");
      }
    };
  }
};

const env = {
  APPLECMS_SOUAVZY_URL: "https://api.souavzy.vip/api.php/provide/vod/",
  PROVIDER_DB: providerDb
};

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
  const categories = await getProviderCategories("souavzy", env);
  assert.deepEqual(categories.map(item => item.id), [11, 12, 20]);
});

test("list adapter exposes only records with approved metadata-only rights", async () => {
  globalThis.caches = { default: { match: async () => null, put: async () => {} } };
  globalThis.fetch = async () => new Response(JSON.stringify({
    code: 1, page: 2, pagecount: 47, total: 463, limit: 10,
    list: [{
      vod_id: 7,
      vod_name: "Metadata-only record",
      vod_pic: "https://img.example/poster.jpg",
      vod_content: "",
      vod_blurb: "Fallback",
      vod_play_from: "HD",
      vod_play_url: "Episode$https://cdn.example/index.m3u8"
    }]
  }), { status: 200, headers: { "content-type": "application/json" } });
  const result = await listProviderVideos("souavzy", { page: 1 }, env);
  assert.equal(result.page, 1);
  assert.equal(result.pageCount, 1);
  assert.equal(result.limit, 30);
  assert.equal(result.total, 1);
  assert.equal(result.items[0].uid, "souavzy:7");
  assert.equal(result.items[0].description, "Fallback");
  assert.equal(result.items[0].rightsStatus, "APPROVED");
  assert.deepEqual(result.items[0].rightsPermittedUses, ["metadata_only"]);
  assert.equal(result.items[0].playbackEnabled, false);
  assert.deepEqual(result.items[0].lines, []);
  assert.equal(result.rightsGate.playbackEnabled, false);
});

test("provider URL is constrained to the approved HTTPS host and path", async () => {
  const badEnv = { ...env, APPLECMS_SOUAVZY_URL: "https://evil.example/api.php/provide/vod/" };
  await assert.rejects(() => getProviderCategories("souavzy", badEnv), error => error.status === 503);
});
