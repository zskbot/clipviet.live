// Same-origin bridge to the Admin API Worker.
// Cloudflare Access authenticates the Pages Preview request; forward its signed JWT
// assertion to the Worker for independent server-side signature/audience/email checks.
// Never forward browser cookies or trust an unverified identity header.
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
  const accessAssertion = request.headers.get("cf-access-jwt-assertion");
  if (incoming.pathname.startsWith("/api/admin/") && request.method !== "OPTIONS" && !accessAssertion) {
    return new Response(JSON.stringify({ error: "Cloudflare Access authentication required" }), {
      status: 401,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
    });
  }
  const upstream = new URL(incoming.pathname + incoming.search, UPSTREAM);
  const headers = new Headers(request.headers);
  headers.set("Origin", TRUSTED_ORIGIN);
  if (accessAssertion) headers.set("cf-access-jwt-assertion", accessAssertion);
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
