import { appleCmsProviderStatuses } from "../../_lib/applecms-worker.js";

const headers = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer"
};

export async function onRequest({ request, env }) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response(JSON.stringify({
      success: false,
      error: "Method not allowed",
      code: "METHOD_NOT_ALLOWED"
    }), { status: 405, headers: { ...headers, allow: "GET, HEAD" } });
  }

  const payload = {
    success: true,
    providers: appleCmsProviderStatuses(env),
    rightsGate: {
      policy: "deny-by-default",
      providerAndVideoApprovalRequired: true,
      playbackEnabled: false
    }
  };

  return new Response(request.method === "HEAD" ? null : JSON.stringify(payload), {
    status: 200,
    headers
  });
}
