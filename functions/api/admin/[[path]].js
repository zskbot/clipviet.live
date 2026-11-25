// Same-origin bridge to the authenticated Admin API Worker.
// Only the server-side request uses the legacy allowlisted Pages origin;
// browser traffic remains same-origin and no credentials are stored here.
const UPSTREAM = "https://clipviet-catalog-api-preview.huynhthuongg2505-f9b.workers.dev";
const TRUSTED_ORIGIN = "https://3e1ad354.clipviet-live-qa.pages.dev";
const ALLOWED_METHODS = new Set(["GET", "HEAD", "POST", "PUT", "DELETE", "OPTIONS"]);

export async function onRequest({ request }) {
  if (!ALLOWED_METHODS.has(request.method)) {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "content-type": "application/json; charset=utf-8", "allow": "GET, HEAD, POST, PUT, DELETE, OPTIONS" }
    });
  }

  const incoming = new URL(request.url);
  const upstream = new URL(incoming.pathname + incoming.search, UPSTREAM);
  const headers = new Headers(request.headers);
  headers.set("Origin", TRUSTED_ORIGIN);
  headers.delete("cookie");
  headers.delete("host");

  try {
    const init = {
      method: request.method,
      headers,
      redirect: "error",
      cache: "no-store"
    };
    if (!["GET", "HEAD"].includes(request.method) && request.body) init.body = request.body;

    const response = await fetch(upstream, init);
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
    return new Response(JSON.stringify({ error: "Admin service is temporarily unavailable" }), {
      status: 502,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
    });
  }
}
