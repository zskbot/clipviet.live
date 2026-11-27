import { appleCmsProviderStatuses, listAppleCmsVideos, AppleCmsProviderError } from "../../../_lib/applecms-worker.js";
const headers = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" };
const json = (body, status = 200, method = "GET") => new Response(method === "HEAD" ? null : JSON.stringify(body), { status, headers });
export async function onRequest({ request, env }) {
  if (request.method !== "GET" && request.method !== "HEAD") return json({ success: false, code: "METHOD_NOT_ALLOWED" }, 405, request.method);
  const url = new URL(request.url);
  const sourceId = (url.searchParams.get("sourceId") || "").trim();
  const states = appleCmsProviderStatuses(env).filter(provider => !sourceId || provider.id === sourceId);
  if (sourceId && !states.length) return json({ success: false, code: "UNKNOWN_PROVIDER", error: "Unknown provider." }, 404, request.method);
  const results = await Promise.all(states.map(async provider => {
    if (!provider.configured) return { ...provider, diagnostic: "NOT_CONFIGURED", latencyMs: null };
    if (!provider.rightsApproved) return { ...provider, diagnostic: "PENDING_RIGHTS", latencyMs: null };
    const started = Date.now();
    try {
      const result = await listAppleCmsVideos(new Request("https://clipviet-preview.invalid/api/providers/applecms/videos?sourceId=" + encodeURIComponent(provider.id) + "&page=1&limit=1"), env);
      return { ...provider, operationalState: "ACTIVE", diagnostic: "HEALTHY", latencyMs: Date.now() - started, upstreamTotal: result.total };
    } catch (error) {
      return { ...provider, operationalState: "ERROR", diagnostic: error.code || "PROVIDER_ERROR",
        errorCode: error instanceof AppleCmsProviderError ? error.code : "PROVIDER_ERROR", latencyMs: Date.now() - started };
    }
  }));
  return json({ success: true, checkedAt: new Date().toISOString(), policy: "Only configured providers with approved provider rights are contacted.",
    providers: results, summary: { total: results.length, healthy: results.filter(item => item.diagnostic === "HEALTHY").length,
      pendingRights: results.filter(item => item.diagnostic === "PENDING_RIGHTS").length,
      notConfigured: results.filter(item => item.diagnostic === "NOT_CONFIGURED").length,
      errors: results.filter(item => item.operationalState === "ERROR").length } }, 200, request.method);
}
