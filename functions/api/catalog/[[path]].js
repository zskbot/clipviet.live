export async function onRequest({ request }) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
  }
  // Fail closed until a Preview Worker is deployed with a reviewed, title-level rights manifest.
  // Do not proxy to the legacy AppleCMS Worker: none of its configured providers is cleared.
  const body = JSON.stringify({
    error: "Catalog unavailable: no source has verified distribution rights",
    code: "PROVIDER_RIGHTS_PENDING",
    rightsPolicy: "deny-by-default",
    targetCount: 130921,
    verifiedCount: 0,
    items: [],
    total: 0,
    page: 1,
    limit: 30,
    pageCount: 0,
    playbackEnabled: false
  });
  return new Response(request.method === "HEAD" ? null : body, {
    status: 503,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "x-clipviet-catalog-source": "rights-gated-preview"
    }
  });
}
