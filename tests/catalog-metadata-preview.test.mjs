import test from "node:test";
import assert from "node:assert/strict";
import { onRequest } from "../functions/api/catalog/[[path]].js";

test("catalog proxy forwards only the requested Preview catalog route and preserves metadata response", async () => {
  const originalFetch = globalThis.fetch;
  let requestInfo;
  const upstreamPayload = {
    success: true,
    items: [{
      id: "metadata-only-001",
      title: "Public-domain metadata record",
      playbackEnabled: false,
      playbackRightsApproved: false,
      lines: []
    }],
    total: 43,
    page: 2,
    limit: 10,
    pageCount: 5,
    rightsGate: { policy: "deny-by-default", playbackEnabled: false }
  };
  globalThis.fetch = async (input, init) => {
    requestInfo = {
      url: String(input),
      method: init.method,
      origin: new Headers(init.headers).get("Origin"),
      accept: new Headers(init.headers).get("Accept"),
      redirect: init.redirect
    };
    return new Response(JSON.stringify(upstreamPayload), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  };
  try {
    const response = await onRequest({
      request: new Request("https://preview.example/api/catalog/videos?page=2&limit=10")
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("x-clipviet-catalog-source"), "applecms-metadata-preview-worker");
    assert.deepEqual(await response.json(), upstreamPayload);
    assert.equal(requestInfo.url, "https://clipviet-catalog-metadata-preview.huynhthuongg2505-f9b.workers.dev/api/catalog/videos?page=2&limit=10");
    assert.equal(requestInfo.method, "GET");
    assert.equal(requestInfo.origin, "https://024bcb8c.clipviet-live-independent-preview.pages.dev");
    assert.equal(requestInfo.accept, "application/json");
    assert.equal(requestInfo.redirect, "manual");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("catalog proxy rejects writes without calling upstream", async () => {
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => { called = true; throw new Error("must not be called"); };
  try {
    const response = await onRequest({
      request: new Request("https://preview.example/api/catalog/videos", { method: "POST" })
    });
    assert.equal(response.status, 405);
    assert.equal(response.headers.get("allow"), "GET, HEAD");
    assert.equal(called, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("catalog proxy returns a no-store 502 when the Preview Worker is unavailable", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("upstream offline"); };
  try {
    const response = await onRequest({
      request: new Request("https://preview.example/api/catalog/videos?page=1")
    });
    assert.equal(response.status, 502);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(await response.json(), { error: "AppleCMS metadata Preview Worker unavailable" });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
