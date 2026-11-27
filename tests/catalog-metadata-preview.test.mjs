import test from "node:test";
import assert from "node:assert/strict";
import { onRequest } from "../functions/api/catalog/[[path]].js";

test("catalog proxy forwards query and preserves the Worker deny-by-default response", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = null;
  let forwardedOrigin = "";
  const upstreamPayload = {
    success: true,
    items: [],
    page: 2,
    pageCount: 0,
    total: 0,
    limit: 30,
    rightsGate: {
      policy: "deny-by-default",
      providerApproved: false,
      approvedCount: 0,
      playbackEnabled: false
    }
  };
  globalThis.fetch = async (input, init = {}) => {
    requestedUrl = new URL(String(input));
    forwardedOrigin = new Headers(init.headers).get("Origin") || "";
    return new Response(JSON.stringify(upstreamPayload), {
      status: 200,
      headers: { "content-type": "application/json; charset=utf-8" }
    });
  };
  try {
    const response = await onRequest({
      request: new Request("https://preview.example/api/catalog/videos?page=2&limit=10")
    });
    assert.equal(response.status, 200);
    assert.equal(requestedUrl.origin, "https://clipviet-catalog-metadata-preview.huynhthuongg2505-f9b.workers.dev");
    assert.equal(requestedUrl.pathname, "/api/catalog/videos");
    assert.equal(requestedUrl.searchParams.get("page"), "2");
    assert.equal(requestedUrl.searchParams.get("limit"), "10");
    assert.equal(forwardedOrigin, "https://024bcb8c.clipviet-live-independent-preview.pages.dev");
    assert.equal(response.headers.get("x-clipviet-catalog-source"), "applecms-metadata-preview-worker");
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(await response.json(), upstreamPayload);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("catalog proxy rejects unsupported methods without contacting the Worker", async () => {
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
