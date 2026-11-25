import test from "node:test";
import assert from "node:assert/strict";
import { searchVideos } from "../lib/video-search.mjs";

const videos = [
  { id: "1", title: "Hành trình đại dương", description: "Khám phá biển", category: "Tài liệu" },
  { id: "2", title: "Thành phố đêm", description: "Tâm lý đô thị", category: "Tâm lý" },
  { id: "3", title: "Đại dương xanh", description: "Thiên nhiên", category: "Tài liệu" }
];

test("search matches Vietnamese title, description and category", () => {
  assert.deepEqual(searchVideos(videos, new URLSearchParams("q=đại dương")).results.map(x => x.id), ["1", "3"]);
});

test("category and pagination are applied together", () => {
  const result = searchVideos(videos, new URLSearchParams("category=T%C3%A0i+li%E1%BB%87u&page=2&limit=1"));
  assert.deepEqual(result.results.map(x => x.id), ["3"]);
  assert.equal(result.total, 2);
  assert.equal(result.hasMore, false);
});

test("invalid search inputs are rejected", () => {
  assert.throws(() => searchVideos(videos, new URLSearchParams("q=" + "x".repeat(121))), RangeError);
  assert.throws(() => searchVideos(videos, new URLSearchParams("limit=101")), RangeError);
});
