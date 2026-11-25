// Same-origin bridge to the read-only catalog Worker.
// The Worker currently allowlists the legacy Pages preview origin; this
// server-side request uses that approved origin and removes CORS headers
// before returning the response to this Pages origin.
const UPSTREAM = "https://clipviet-catalog-readonly-preview.huynhthuongg2505-f9b.workers.dev";
const TRUSTED_ORIGIN = "https://3e1ad354.clipviet-live-qa.pages.dev";
const ALLOWED_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export async function onRequest({ request }) {
  if (!ALLOWED_METHODS.has(request.method)) {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "content-type": "application/json; charset=utf-8", "allow": "GET, HEAD, OPTIONS" }
    });
  }

  const incoming = new URL(request.url);
  const upstream = new URL(incoming.pathname + incoming.search, UPSTREAM);
  const headers = new Headers(request.headers);
  headers.set("Origin", TRUSTED_ORIGIN);
  headers.delete("cookie");
  headers.delete("host");

  try {
    const response = await fetch(upstream, {
      method: request.method,
      headers,
      redirect: "error",
      cache: "no-store"
    });
    const responseHeaders = new Headers(response.headers);
    for (const name of [
      "access-control-allow-origin",
      "access-control-allow-methods",
      "access-control-allow-headers",
      "access-control-expose-headers",
      "access-control-max-age",
      "vary"
    ]) responseHeaders.delete(name);

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders
    });
  } catch {
    return new Response(JSON.stringify({ error: "Catalog service is temporarily unavailable" }), {
      status: 502,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
    });
  }
}
