const UPSTREAM = "https://clipviet-catalog-metadata-preview.huynhthuongg2505-f9b.workers.dev";
const TRUSTED_WORKER_ORIGIN = "https://024bcb8c.clipviet-live-independent-preview.pages.dev";

export async function onRequest({ request }) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", {
      status: 405,
      headers: { Allow: "GET, HEAD", "cache-control": "no-store" }
    });
  }

  try {
    const target = new URL(UPSTREAM + "/api/catalog/videos");
    target.search = new URL(request.url).search;
    const upstream = await fetch(target.toString(), {
      method: request.method,
      headers: {
        Accept: request.headers.get("Accept") || "application/json",
        Origin: TRUSTED_WORKER_ORIGIN
      },
      redirect: "manual"
    });
    const headers = new Headers(upstream.headers);
    headers.set("cache-control", "no-store");
    headers.set("x-content-type-options", "nosniff");
    headers.set("x-clipviet-catalog-source", "metadata-preview-worker");
    return new Response(upstream.body, { status: upstream.status, headers });
  } catch {
    return new Response(JSON.stringify({
      success: false,
      error: "Catalog metadata service unavailable",
      code: "CATALOG_UPSTREAM_UNAVAILABLE"
    }), {
      status: 502,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff"
      }
    });
  }
}
