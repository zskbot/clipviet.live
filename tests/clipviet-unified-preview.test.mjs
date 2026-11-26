import test from "node:test";
import assert from "node:assert/strict";
import gateway from "../workers/clipviet-unified-preview/src/index.mjs";

const env = {
  FRONTEND_ORIGIN: "https://frontend-preview.example.pages.dev",
  MODULES_ORIGIN: "https://modules-preview.example.pages.dev",
  VIDEO_CMS_ORIGIN: "https://video-cms-preview.example.workers.dev"
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
    assert.equal(await response.text(), "frontend");
  });
});

test("docs route to the secondary repository API documentation", async () => {
  await withFetch(async request => {
    assert.equal(new URL(request.url).origin, env.MODULES_ORIGIN);
    assert.equal(new URL(request.url).pathname, "/docs/");
    return new Response("docs");
  }, async () => {
    const response = await gateway.fetch(new Request("https://router-preview.example.workers.dev/docs"), env);
    assert.equal(await response.text(), "docs");
  });
});


test("API reference has its own route", async () => {
  await withFetch(async request => {
    assert.equal(new URL(request.url).origin, env.MODULES_ORIGIN);
    assert.equal(new URL(request.url).pathname, "/api-docs/");
    return new Response("api-docs");
  }, async () => {
    const response = await gateway.fetch(new Request("https://router-preview.example.workers.dev/api-docs"), env);
    assert.equal(await response.text(), "api-docs");
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

test("public video, tag and group APIs use the Preview D1 CMS", async () => {
  for (const [path, target] of [["/api/videos", "/public/videos"], ["/api/tags", "/public/tags"], ["/api/groups", "/public/groups"]]) {
    await withFetch(async request => {
      assert.equal(new URL(request.url).origin, env.VIDEO_CMS_ORIGIN);
      assert.equal(new URL(request.url).pathname, target);
      return Response.json({ data: [] });
    }, async () => {
      const response = await gateway.fetch(new Request("https://router-preview.example.workers.dev" + path), env);
      assert.equal(response.status, 200);
    });
  }
});

test("catalog routes pass through the secondary Pages rights gate", async () => {
  await withFetch(async request => {
    assert.equal(new URL(request.url).origin, env.MODULES_ORIGIN);
    assert.equal(new URL(request.url).pathname, "/api/catalog/categories");
    return Response.json({ data: [], pending: true });
  }, async () => {
    const response = await gateway.fetch(new Request("https://router-preview.example.workers.dev/api/catalog/categories"), env);
    assert.equal(response.status, 200);
  });
});

test("admin API forwards Access JWT but never forwards browser cookies", async () => {
  await withFetch(async request => {
    assert.equal(new URL(request.url).origin, env.VIDEO_CMS_ORIGIN);
    assert.equal(new URL(request.url).pathname, "/admin/api/videos");
    assert.equal(request.headers.get("cf-access-jwt-assertion"), "preview-jwt");
    assert.equal(request.headers.get("cookie"), null);
    assert.equal(request.headers.get("authorization"), null);
    return Response.json({ data: [] });
  }, async () => {
    const response = await gateway.fetch(new Request("https://router-preview.example.workers.dev/admin/api/videos", {
      headers: { "cf-access-jwt-assertion": "preview-jwt", cookie: "session=private" }
    }), env);
    assert.equal(response.status, 200);
  });
});

test("admin page routes to the secondary repository and upload remains disabled", async () => {
  await withFetch(async request => {
    assert.equal(new URL(request.url).origin, env.MODULES_ORIGIN);
    assert.equal(new URL(request.url).pathname, "/admin/");
    return new Response("admin");
  }, async () => {
    const response = await gateway.fetch(new Request("https://router-preview.example.workers.dev/admin"), env);
    assert.equal(await response.text(), "admin");
  });
  const upload = await gateway.fetch(new Request("https://router-preview.example.workers.dev/upload"), env);
  assert.equal(upload.status, 501);
  assert.equal((await upload.json()).code, "VIDEO_STORAGE_NOT_PROVISIONED");
});

test("unsupported API writes are rejected outside the protected Admin path", async () => {
  const response = await gateway.fetch(new Request("https://router-preview.example.workers.dev/api/catalog/videos", { method: "POST" }), env);
  assert.equal(response.status, 405);
});
