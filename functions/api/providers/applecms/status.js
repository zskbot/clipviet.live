import { appleCmsProviderStatuses } from "../../../_lib/applecms-worker.js";
export async function onRequest({ request, env }) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { "content-type": "application/json; charset=utf-8", allow: "GET, HEAD" }
    });
  }
  const body = JSON.stringify({
    success: true,
    providers: appleCmsProviderStatuses(env),
    rightsGate: { policy: "deny-by-default", metadataOnly: true, playbackEnabled: false }
  });
  return new Response(request.method === "HEAD" ? null : body, {
    status: 200, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}
