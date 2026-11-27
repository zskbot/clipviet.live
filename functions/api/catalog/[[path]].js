const UPSTREAM = "https://clipviet-catalog-readonly-preview.huynhthuongg2505-f9b.workers.dev";
const TRUSTED_WORKER_ORIGIN = "https://024bcb8c.clipviet-live-independent-preview.pages.dev";

export async function onRequest({ request }) {
  const incoming = new URL(request.url);
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
  }
  const prefix = "/api/catalog/";
  const suffix = incoming.pathname.startsWith(prefix) ? incoming.pathname.slice(prefix.length) : "";
  const target = new URL(UPSTREAM + "/api/catalog/" + suffix);
  target.search = incoming.search;
  try {
    const upstream = await fetch(target.toString(), {
      method: request.method,
      headers: {
        Accept: request.headers.get("Accept") || "application/json",
        Origin: TRUSTED_WORKER_ORIGIN
      },
      redirect: "follow"
    });
    const headers = new Headers(upstream.headers);
    headers.set("cache-control", "no-store");
    headers.set("x-clipviet-catalog-source", "applecms-preview-worker");
    return new Response(upstream.body, { status: upstream.status, headers });
  } catch {
    return new Response(JSON.stringify({ error: "AppleCMS Preview Worker unavailable" }), {
      status: 502,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
    });
  }
}
