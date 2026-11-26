import test from "node:test";
import assert from "node:assert/strict";
import gateway from "../workers/clipviet-unified-preview/src/index.mjs";

const env = {
  FRONTEND_ORIGIN: "https://frontend-preview.example.pages.dev",
  MODULES_ORIGIN: "https://modules-preview.example.pages.dev",
  CATALOG_API_ORIGIN: "https://catalog-preview.example.workers.dev"
};

async function withFetch(mock, callback) {
  const original = globalThis.fetch;
  globalThis.fetch = mock;
  try { return await callback(); } finally { globalThis.fetch = original; }
}

test("root routes to the primary frontend Preview", async () => {
  await withFetch(async request => {
    assert.equal(new URL(request.url).origin, env.FRONTEND_ORIGIN);
    assert.equal(new URL(request.url).pathname, "/");
    return new Response("frontend");
  }, async () => {
    const response = await gateway.fetch(new Request("https://router-preview.example.workers.dev/"), env);
    assert.equal(response.status, 200);
    assert.equal(await response.text(), "frontend");
  });
});

test("docs route to the secondary repository API documentation", async () => {
  await withFetch(async request => {
    assert.equal(new URL(request.url).origin, env.MODULES_ORIGIN);
    assert.equal(new URL(request.url).pathname, "/api-docs/");
    return new Response("docs");
  }, async () => {
    const response = await gateway.fetch(new Request("https://router-preview.example.workers.dev/docs"), env);
    assert.equal(await response.text(), "docs");
  });
});

test("video, tag and group routes use the secondary modules Preview", async () => {
  for (const path of ["/video/", "/tag/", "/group/"]) {
    await withFetch(async request => {
      assert.equal(new URL(request.url).origin, env.MODULES_ORIGIN);
      assert.equal(new URL(request.url).pathname, path);
      return new Response(path);
    }, async () => {
      const response = await gateway.fetch(new Request("https://router-preview.example.workers.dev" + path), env);
      assert.equal(await response.text(), path);
    });
  }
});

test("catalog API is proxied read-only without forwarding browser credentials", async () => {
  await withFetch(async request => {
    const url = new URL(request.url);
    assert.equal(url.origin, env.CATALOG_API_ORIGIN);
    assert.equal(url.pathname, "/api/catalog/videos");
    assert.equal(url.searchParams.get("page"), "2");
    assert.equal(request.headers.get("authorization"), null);
    assert.equal(request.headers.get("cookie"), null);
    assert.equal(request.headers.get("origin"), null);
    return Response.json({ items: [] });
  }, async () => {
    const response = await gateway.fetch(new Request("https://router-preview.example.workers.dev/api/catalog/videos?page=2", {
      headers: { authorization: "Bearer test-only", cookie: "session=test", origin: "https://router-preview.example.workers.dev" }
    }), env);
    assert.equal(response.status, 200);
  });
});

test("admin and binary uploads remain locked in Preview", async () => {
  const admin = await gateway.fetch(new Request("https://router-preview.example.workers.dev/admin"), env);
  assert.equal(admin.status, 423);
  assert.equal((await admin.json()).code, "ADMIN_PREVIEW_LOCKED");
  const upload = await gateway.fetch(new Request("https://router-preview.example.workers.dev/upload"), env);
  assert.equal(upload.status, 501);
  assert.equal((await upload.json()).code, "VIDEO_STORAGE_NOT_PROVISIONED");
});

test("unsupported catalog write methods are rejected", async () => {
  const response = await gateway.fetch(new Request("https://router-preview.example.workers.dev/api/catalog/videos", { method: "POST" }), env);
  assert.equal(response.status, 405);
});
