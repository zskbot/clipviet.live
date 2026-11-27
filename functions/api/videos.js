const PROVIDERS = [
  { "id": "souavzy", status: "PENDING", enabled: false, rightsApproved: false },
  { "id": "apiyutu", status: "PENDING", enabled: false, rightsApproved: false },
  { "id": "lbapi9", status: "PENDING", enabled: false, rightsApproved: false },
  { "id": "slapibf", status: "PENDING", enabled: false, rightsApproved: false },
  { "id": "jipinvip1", status: "PENDING", enabled: false, rightsApproved: false }
];
const ALLOW = "GET, HEAD, OPTIONS";
const headers = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "allow": ALLOW, "x-content-type-options": "nosniff" };
const json = (body, status = 200, method = "GET") => new Response(method === "HEAD" ? null : JSON.stringify(body), { status, headers });
export async function onRequest({ request }) {
  const url = new URL(request.url);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method !== "GET" && request.method !== "HEAD") {
    return json({ success: false, error: "Method not allowed", allow: ["GET", "HEAD", "OPTIONS"] }, 405);
  }
  const rawPage = url.searchParams.get("page") ?? url.searchParams.get("currentPage") ?? "1";
  const rawLimit = url.searchParams.get("limit") ?? url.searchParams.get("pageSize") ?? url.searchParams.get("per_page") ?? "20";
  if (!/^[0-9]+$/.test(rawPage) || !/^[0-9]+$/.test(rawLimit)) return json({ success: false, error: "Invalid pagination", code: "INVALID_PAGINATION" }, 400, request.method);
  const page = Number(rawPage), limit = Number(rawLimit);
  if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    return json({ success: false, error: "Pagination must use a positive page and a limit between 1 and 100", code: "INVALID_PAGINATION" }, 400, request.method);
  }
  const id = (url.searchParams.get("id") || "").trim();
  if (id) return json({ success: false, error: "Video not found", code: "VIDEO_NOT_FOUND" }, 404, request.method);
  const query = (url.searchParams.get("keyword") || url.searchParams.get("q") || url.searchParams.get("search") || "").trim().slice(0, 100);
  const categoryId = (url.searchParams.get("categoryId") || url.searchParams.get("category") || "").trim().slice(0, 80);
  const payload = {
    success: true,
    endpoint: "/api/videos",
    source: "rights-gated-preview",
    results: [],
    items: [],
    total: 0,
    page,
    limit,
    pageCount: 0,
    query,
    category: categoryId,
    categoryId,
    filters: { query, categoryId },
    providers: PROVIDERS,
    rightsGate: {
      policy: "deny-by-default",
      externalFetchingEnabled: false,
      publicPlaybackEnabled: false
    }
  };
  return json(payload, 200, request.method);
}