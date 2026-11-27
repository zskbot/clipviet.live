// Legacy endpoint disabled: previous implementation returned source playback URLs
// without a provider + per-video rights decision. Use the normalized routes under
// /api/providers/applecms/* instead.
export async function onRequest({ request }) {
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "deprecation": "true",
    "link": '</api/providers/applecms/videos>; rel="successor-version"'
  };
  return new Response(request.method === "HEAD" ? null : JSON.stringify({
    success: false,
    code: "LEGACY_PLAYBACK_ENDPOINT_DISABLED",
    error: "This legacy endpoint is disabled. Use the rights-gated provider categories, videos, detail and playback endpoints."
  }), { status: 410, headers });
}
