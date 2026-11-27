import { appleCmsProviderStatuses, AppleCmsProviderError } from "../../../_lib/applecms-worker.js";
const headers = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" };
export async function onRequest({ request, env }) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response(JSON.stringify({ success: false, error: "Method not allowed", code: "METHOD_NOT_ALLOWED" }), { status: 405, headers: { ...headers, allow: "GET, HEAD" } });
  }
  const payload = {
    success: true,
    providers: appleCmsProviderStatuses(env),
    states: ["NOT_CONFIGURED", "PENDING_RIGHTS", "METADATA_ONLY", "PLAYBACK_APPROVED"],
    operationalStates: ["NOT_CHECKED", "ACTIVE", "ERROR"],
    rightsGate: { policy: "deny-by-default", providerAndVideoApprovalRequired: true, playbackEnabled: false }
  };
  return new Response(request.method === "HEAD" ? null : JSON.stringify(payload), { status: 200, headers });
}
