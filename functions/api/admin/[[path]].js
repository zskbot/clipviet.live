// Public Admin is intentionally read-only. Exact GET routes live in videos.js and providers.js.
export async function onRequest({ request }) {
  const headers = { "content-type":"application/json; charset=utf-8", "cache-control":"no-store", "allow":"GET, HEAD, OPTIONS" };
  if (request.method === "OPTIONS") return new Response(null, { status:204, headers });
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response(request.method === "HEAD" ? null : JSON.stringify({ error:"Admin API is read-only", allow:["GET","HEAD","OPTIONS"] }), { status:405, headers });
  }
  return new Response(request.method === "HEAD" ? null : JSON.stringify({ error:"Admin read route not found" }), { status:404, headers });
}
