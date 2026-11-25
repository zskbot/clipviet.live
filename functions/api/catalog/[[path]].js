// Public catalog safety gate for the independent Preview.
// All five seeded providers are PENDING in Provider Registry and have no
// verified distribution-rights records. Do not fetch or expose provider
// media until the legal/rights workflow approves the relevant sources.
const PROVIDER_CATALOG_ENABLED = false;
const UPSTREAM = "https://clipviet-catalog-readonly-preview.huynhthuongg2505-f9b.workers.dev";
const TRUSTED_ORIGIN = "https://3e1ad354.clipviet-live-qa.pages.dev";
const ALLOWED_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff"
    }
  });
}

export async function onRequest({ request }) {
  if (!ALLOWED_METHODS.has(request.method)) {
    return json({ error: "Method not allowed" }, 405);
  }

  const incoming = new URL(request.url);
  if (!PROVIDER_CATALOG_ENABLED) {
    if (incoming.pathname === "/api/catalog/categories") {
      return json({ data: [], pending: true, notice: "Provider integrations are pending rights verification." });
    }
    if (incoming.pathname === "/api/catalog/videos") {
      return json({
        items: [],
        page: Math.max(1, Number.parseInt(incoming.searchParams.get("page") || "1", 10) || 1),
        pageCount: 0,
        total: 0,
        limit: 30,
        pending: true,
        notice: "No provider content is published until distribution rights are approved."
      });
    }
    return json({ error: "Catalog route not found" }, 404);
  }

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
    return json({ error: "Catalog service is temporarily unavailable" }, 502);
  }
}
