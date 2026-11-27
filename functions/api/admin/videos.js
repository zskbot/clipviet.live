// Public read-only Admin API proxy. No browser-to-Worker CORS dependency.
const UPSTREAM = "https://clipviet-video-cms-preview.huynhthuongg2505-f9b.workers.dev/admin/api/videos";

export async function onRequest({ request }) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { "allow": "GET, HEAD, OPTIONS", "cache-control": "no-store" } });
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    return Response.json({ error: "Read-only Admin: write operations are disabled." }, {
      status: 403, headers: { "cache-control": "no-store", "allow": "GET, HEAD, OPTIONS" }
    });
  }
  const upstream = await fetch(UPSTREAM, { method: request.method, headers: { "accept": "application/json" } });
  const headers = new Headers(upstream.headers);
  headers.set("cache-control", "no-store");
  headers.set("x-content-type-options", "nosniff");
  headers.delete("access-control-allow-origin");
  return new Response(request.method === "HEAD" ? null : await upstream.arrayBuffer(), {
    status: upstream.status, headers
  });
}
