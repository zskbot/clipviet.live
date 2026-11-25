import test from "node:test";
import assert from "node:assert/strict";
import { normalizeAdultEmbedVideo, normalizeAdultEmbedSearch, buildAdultEmbedSearchUrl } from "../site/admin/adultembed-adapter.mjs";

test("normalizes AdultEmbed metadata without exposing arbitrary embed hosts", () => {
  const video = normalizeAdultEmbedVideo({
    id: 42, title: "Sample title", thumbnail: "https://pornalizer.app/thumb.webp",
    duration_seconds: 125, duration: "02:05", tags: ["tag-a"],
    categories: [{name:"Category A",slug:"category-a"}],
    embed: {url:"https://pornalizer.app/player/embed/42/"}
  });
  assert.equal(video.id, "42");
  assert.equal(video.durationSeconds, 125);
  assert.deepEqual(video.tags, ["tag-a"]);
  assert.deepEqual(video.categories, ["Category A"]);
  assert.equal(new URL(video.embedUrl).hostname, "pornalizer.app");
  const unsafe = normalizeAdultEmbedVideo({id:43,title:"Unsafe",thumbnail:"https://attacker.example/x",embed:{url:"https://attacker.example/player"}});
  assert.equal(unsafe.thumbnail, "");
  assert.equal(unsafe.embedUrl, "");
});

test("rejects malformed records and malformed search envelopes", () => {
  assert.equal(normalizeAdultEmbedVideo({id:"nope",title:"Bad"}), null);
  assert.throws(() => normalizeAdultEmbedSearch({items:[]}), /results array/);
});

test("builds bounded search requests against the canonical API origin", () => {
  const url = new URL(buildAdultEmbedSearchUrl("  sample  ", 0, 999));
  assert.equal(url.origin, "https://adultembed.com");
  assert.equal(url.searchParams.get("query"), "sample");
  assert.equal(url.searchParams.get("page"), "1");
  assert.equal(url.searchParams.get("per_page"), "20");
  assert.equal(url.searchParams.get("orientation"), "all");
});
