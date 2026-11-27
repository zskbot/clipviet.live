import { getAppleCmsVideoDetail, AppleCmsProviderError } from "../../../../_lib/applecms-worker.js";
const json = (body, status = 200, method = "GET") => new Response(method === "HEAD" ? null : JSON.stringify(body), {
  status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" }
});
export async function onRequest({ request, env, params }) {
  if (request.method !== "GET" && request.method !== "HEAD") return json({ success: false, error: "Method not allowed", code: "METHOD_NOT_ALLOWED" }, 405, request.method);
  try { return json(await getAppleCmsVideoDetail(request, env, { videoId: params?.id }), 200, request.method); }
  catch (error) {
    const status = error instanceof AppleCmsProviderError ? error.status : 502;
    return json({ success: false, error: error.message || "Provider detail request failed", code: error.code || "PROVIDER_ERROR" }, status, request.method);
  }
}
