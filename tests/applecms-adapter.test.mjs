import test from "node:test";
import assert from "node:assert/strict";
import {
  assertProviderApproved,
  mapAppleCmsCategories,
  mapAppleCmsVideo,
  normalizeAppleCmsPayload,
  parseAppleCmsPlayManifest,
  ProviderRightsPendingError,
  runApprovedProviderFailover
} from "../site/applecms-adapter.js";

test("provider access stays denied until its ID is explicitly approved", () => {
  assert.throws(() => assertProviderApproved("souavzy"), ProviderRightsPendingError);
  assert.equal(assertProviderApproved("fixture", ["fixture"]), true);
});

test("normalizes only valid AppleCMS collection responses", () => {
  assert.deepEqual(normalizeAppleCmsPayload({ code: 1, class: [{ type_id: 2 }] }, "class"), [{ type_id: 2 }]);
  assert.throws(() => normalizeAppleCmsPayload({ code: 0, list: [] }), /response code/);
  assert.throws(() => normalizeAppleCmsPayload({ code: 1, list: {} }), /collection/);
});

test("shows non-root categories and removes duplicate IDs", () => {
  const categories = mapAppleCmsCategories([
    { type_id: 1, type_pid: 0, type_name: "Root" },
    { type_id: 2, type_pid: 1, type_name: "Action" },
    { type_id: 2, type_pid: 1, type_name: "Duplicate" },
    { type_id: 3, type_pid: 1, type_name: "Drama" }
  ]);
  assert.deepEqual(categories, [
    { id: "2", parentId: "1", name: "Action" },
    { id: "3", parentId: "1", name: "Drama" }
  ]);
});

test("parses line and episode labels without returning media URLs", () => {
  const lines = parseAppleCmsPlayManifest(
    "Line A$$$Line B",
    "Episode 1$https://cdn.example/a.m3u8#Episode 2$https://cdn.example/b.m3u8$$$Full$https://cdn.example/full.mp4"
  );
  assert.deepEqual(lines, [
    { lineName: "Line A", episodes: [{ name: "Episode 1" }, { name: "Episode 2" }] },
    { lineName: "Line B", episodes: [{ name: "Full" }] }
  ]);
  assert.equal(JSON.stringify(lines).includes("cdn.example"), false);
});

test("maps source-scoped metadata, HTTPS posters and description fallback", () => {
  const item = mapAppleCmsVideo({
    vod_id: 42,
    vod_name: "Synthetic Licensed Fixture",
    type_id: 8,
    type_name: "Documentary",
    vod_pic: "https://images.example/poster.jpg",
    vod_content: "",
    vod_blurb: "<p>Fixture description</p>",
    vod_play_from: "Fixture",
    vod_play_url: "Episode 1$https://media.example/fixture.m3u8"
  }, { sourceId: "fixture-source", sourceName: "Fixture Source" });
  assert.equal(item.uid, "fixture-source:42");
  assert.equal(item.poster, "https://images.example/poster.jpg");
  assert.equal(item.description, "Fixture description");
  assert.equal(item.playbackEnabled, false);
  assert.equal(item.rightsStatus, "PENDING");
  assert.deepEqual(item.lines, [{ lineName: "Fixture", episodes: [{ name: "Episode 1" }] }]);
  assert.equal(mapAppleCmsVideo({ vod_id: 43, vod_name: "Student story" }, { sourceId: "fixture" }), null);
  assert.equal(mapAppleCmsVideo({ vod_id: 44, vod_name: "Unsafe poster", vod_pic: "javascript:alert(1)" }, { sourceId: "fixture" }).poster, "");
});

test("failover advances only after a thrown provider error; empty results are valid", async () => {
  const attempts = [];
  const result = await runApprovedProviderFailover(
    ["primary", "backup", "last"],
    ["primary", "backup", "last"],
    async (id) => {
      attempts.push(id);
      if (id === "primary") throw new Error("provider unavailable");
      return [];
    }
  );
  assert.deepEqual(attempts, ["primary", "backup"]);
  assert.deepEqual(result, []);
});

test("failover never calls a provider outside the approved allowlist", async () => {
  let called = false;
  await assert.rejects(
    runApprovedProviderFailover(["souavzy", "apiyutu"], [], async () => { called = true; }),
    ProviderRightsPendingError
  );
  assert.equal(called, false);
});
