import test from "node:test";
import assert from "node:assert/strict";
import { onRequest } from "../functions/api/videos.js";
import { onRequest as onVideoIdRequest } from "../functions/api/videos/[id].js";

const request = (path, method = "GET") => new Request("https://preview.example.test" + path, { method });

test("legacy aliases normalize to the unified API response contract", async () => {
  const response = await onRequest({ request: request("/api/videos?keyword=hello&categoryId=drama&pageSize=20&currentPage=2") });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.query, "hello");
  assert.equal(body.categoryId, "drama");
  assert.equal(body.page, 2);
  assert.equal(body.limit, 20);
  assert.deepEqual(body.results, []);
  assert.deepEqual(body.items, []);
});

test("GET rejects invalid pagination and unsupported video IDs", async () => {
  const invalidPage = await onRequest({ request: request("/api/videos?page=0") });
  assert.equal(invalidPage.status, 400);
  const invalidLimit = await onRequest({ request: request("/api/videos?limit=101") });
  assert.equal(invalidLimit.status, 400);
  const missing = await onRequest({ request: request("/api/videos?id=unknown-video") });
  assert.equal(missing.status, 404);
  assert.equal(missing.headers.get("content-type"), "application/json; charset=utf-8");
  assert.equal((await missing.json()).code, "VIDEO_NOT_FOUND");
});

test("dynamic missing video path returns JSON 404 instead of Pages HTML fallback", async () => {
  const missing = await onVideoIdRequest({
    request: request("/api/videos/not-a-real-id"),
    params: { id: "not-a-real-id" }
  });
  assert.equal(missing.status, 404);
  assert.equal(missing.headers.get("content-type"), "application/json; charset=utf-8");
  assert.equal((await missing.json()).code, "VIDEO_NOT_FOUND");
});

test("HEAD, OPTIONS and POST have explicit HTTP semantics", async () => {
  const head = await onRequest({ request: request("/api/videos", "HEAD") });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");
  const options = await onRequest({ request: request("/api/videos", "OPTIONS") });
  assert.equal(options.status, 204);
  assert.match(options.headers.get("allow"), /GET, HEAD, OPTIONS/);
  const post = await onRequest({ request: request("/api/videos", "POST") });
  assert.equal(post.status, 405);
  assert.match(post.headers.get("allow"), /GET, HEAD, OPTIONS/);
});

test("gateway remains read-only with every candidate provider disabled", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("gateway must not call upstream"); };
  try {
    const response = await onRequest({ request: request("/api/videos") });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.rightsGate.externalFetchingEnabled, false);
    assert.equal(body.rightsGate.publicPlaybackEnabled, false);
    assert.equal(body.providers.every(provider => provider.status === "PENDING" && !provider.enabled && !provider.rightsApproved), true);
  } finally { globalThis.fetch = originalFetch; }
});
