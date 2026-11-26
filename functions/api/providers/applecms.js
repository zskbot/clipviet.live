import { listApprovedAppleCmsMetadata, appleCmsProviderStatuses } from "../../_lib/applecms-worker.js";
function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: {
    "content-type": "application/json; charset=utf-8", "cache-control": "no-store",
    "x-content-type-options": "nosniff", "referrer-policy": "no-referrer"
  }});
}
export async function onRequest({ request, env }) {
  if (request.method !== "GET" && request.method !== "HEAD") return json({ error: "Method not allowed", allow: ["GET", "HEAD"] }, 405);
  if (request.method === "HEAD") return new Response(null, { status: 200, headers: { "cache-control": "no-store" } });
  const url = new URL(request.url);
  if (url.pathname.endsWith("/status")) return json({
    success: true, providers: appleCmsProviderStatuses(env),
    rightsGate: { policy: "deny-by-default", metadataOnly: true, playbackEnabled: false }
  });
  try { return json(await listApprovedAppleCmsMetadata(request, env)); }
  catch (error) {
    const status = /not approved|not configured|allowlisted|Unknown provider/i.test(String(error?.message || "")) ? 403 : 502;
    return json({ success: false, error: status === 403 ? "Provider is pending approval or configuration." : "Provider request failed.",
      rightsGate: { policy: "deny-by-default", playbackEnabled: false } }, status);
  }
}
