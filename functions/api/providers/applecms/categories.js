import { listAppleCmsCategories, AppleCmsProviderError } from "../../../_lib/applecms-worker.js";
const json = (body, status = 200, method = "GET") => new Response(method === "HEAD" ? null : JSON.stringify(body), {
  status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" }
});
export async function onRequest({ request, env }) {
  if (request.method !== "GET" && request.method !== "HEAD") return json({ success: false, error: "Method not allowed", code: "METHOD_NOT_ALLOWED" }, 405, request.method);
  try { return json(await listAppleCmsCategories(request, env), 200, request.method); }
  catch (error) {
    const status = error instanceof AppleCmsProviderError ? error.status : 502;
    const sourceId = new URL(request.url).searchParams.get("sourceId") || new URL(request.url).searchParams.get("provider") || "";
    return json({ success: false, error: error.message || "Provider categories request failed", code: error.code || "PROVIDER_ERROR",
      provider: sourceId ? { id: sourceId, status: status === 403 ? "PENDING_RIGHTS" : status === 503 ? "NOT_CONFIGURED" : "ERROR", operationalState: status === 403 ? "NOT_CHECKED" : "ERROR" } : null
    }, status, request.method);
  }
}
