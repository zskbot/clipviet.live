import test from "node:test";
import assert from "node:assert/strict";
import { parseMacCmsPlayUrl, normalizeMacCmsItem } from "../lib/maccms-provider.mjs";

test("MacCMS play URL parser handles routes and episodes with last dollar separator", () => {
  const items = parseMacCmsPlayUrl("HD$https://cdn.example.com/a.m3u8#Tập 2$https://cdn.example.com/b.mp4$$$Backup$https://cdn.example.com/c.mp4");
  assert.deepEqual(items.map(item => item.label), ["HD", "Tập 2", "Backup"]);
  assert.equal(items[1].url, "https://cdn.example.com/b.mp4");
  assert.equal(items[2].routeIndex, 1);
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
