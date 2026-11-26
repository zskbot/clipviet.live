// ClipViet Unified Video API — Preview-safe, read-only facade.
// All upstream providers remain PENDING until provider-level and per-video
// distribution rights are independently approved. This endpoint deliberately
// performs no upstream requests and returns no third-party media URLs.
const PROVIDERS = [
  {
    "id": "souavzy",
    "name": "Souavzy · Primary",
    "role": "primary"
  },
  {
    "id": "apiyutu",
    "name": "ApiYutu · Backup 1",
    "role": "backup"
  },
  {
    "id": "lbapi9",
    "name": "LBApi9 · Backup 2",
    "role": "backup"
  },
  {
    "id": "slapibf",
    "name": "Slapibf · Backup 3",
    "role": "backup"
  },
  {
    "id": "jipinvip1",
    "name": "JipinVIP1 · Backup 4",
    "role": "backup"
  }
].map(provider => ({
  ...provider,
  status: "PENDING",
  enabled: false,
  configured: false,
  rightsApproved: false
}));

function json(data, status = 200, method = "GET") {
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer"
  };
  return new Response(method === "HEAD" ? null : JSON.stringify(data), { status, headers });
}

export async function onRequest({ request }) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "allow": "GET, HEAD, OPTIONS",
        "access-control-max-age": "600",
        "access-control-allow-methods": "GET, HEAD, OPTIONS"
      }
    });
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    return json({ error: "Method not allowed", allow: ["GET", "HEAD", "OPTIONS"] }, 405);
  }

  const url = new URL(request.url);
  const params = new URLSearchParams(url.searchParams);
  const aliases = [["keyword", "q"], ["search", "q"], ["pageSize", "limit"], ["per_page", "limit"], ["currentPage", "page"]];
  for (const [legacy, canonical] of aliases) {
    if (!params.has(canonical) && params.has(legacy)) params.set(canonical, params.get(legacy));
  }
  const rawPage = Number(params.get("page") || "1");
  const rawLimit = Number(params.get("limit") || "30");
  const query = (params.get("q") || "").trim().slice(0, 120);
  const categoryId = (params.get("categoryId") || "").trim().slice(0, 120);
  const category = (params.get("category") || "").trim().slice(0, 80);
  const videoId = params.get("id");
  if (!Number.isSafeInteger(rawPage) || rawPage < 1 || rawPage > 10000) {
    return json({ success: false, error: "Page must be an integer between 1 and 10000." }, 400, request.method);
  }
  if (!Number.isSafeInteger(rawLimit) || rawLimit < 1 || rawLimit > 100) {
    return json({ success: false, error: "Limit must be an integer between 1 and 100." }, 400, request.method);
  }
  if ((params.get("q") || "").trim().length > 120 || (params.get("categoryId") || "").trim().length > 120 ||
      (params.get("category") || "").trim().length > 80) {
    return json({ success: false, error: "Search or category filter is too long." }, 400, request.method);
  }
  const page = rawPage;
  const limit = rawLimit;

  if (videoId) {
    return json({
      success: false,
      error: "Video not found in the rights-approved catalog.",
      code: "VIDEO_NOT_FOUND",
      pending: true,
      canonicalEndpoint: "/api/videos"
    }, 404, request.method);
  }

  return json({
    success: true,
    endpoint: "/api/videos",
    query,
    category,
    categoryId,
    version: "1.0.0",
    mode: "rights-gated-unified",
    pending: true,
    notice: "Chưa có nguồn nào được duyệt quyền phân phối. API đang ở chế độ an toàn, chưa truy vấn hoặc phát video từ nguồn bên thứ ba.",
    results: [],
    items: [],
    page,
    limit,
    total: 0,
    pageCount: 0,
    hasMore: false,
    source: "unified-gateway",
    providers: PROVIDERS,
    providerCount: PROVIDERS.length,
    approvedProviderCount: PROVIDERS.filter(provider => provider.status === "ENABLED" && provider.rightsApproved).length,
    rightsGate: {
      policy: "deny-by-default",
      providerApprovalRequired: true,
      perVideoApprovalRequired: true,
      publicPlaybackEnabled: false,
      externalFetchingEnabled: false
    }
  }, 200, request.method);
}
