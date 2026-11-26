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
        "access-control-max-age": "600"
      }
    });
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    return json({ error: "Method not allowed", allow: ["GET", "HEAD", "OPTIONS"] }, 405);
  }

  const url = new URL(request.url);
  const params = url.searchParams;
  const rawPage = Number.parseInt(params.get("page") || params.get("currentPage") || "1", 10);
  const rawLimit = Number.parseInt(params.get("limit") || params.get("pageSize") || params.get("per_page") || "30", 10);
  const page = Number.isSafeInteger(rawPage) ? Math.max(1, Math.min(rawPage, 10000)) : 1;
  const limit = Number.isSafeInteger(rawLimit) ? Math.max(1, Math.min(rawLimit, 100)) : 30;
  const query = (params.get("q") || params.get("keyword") || params.get("search") || "").trim().slice(0, 120);
  const categoryId = (params.get("categoryId") || params.get("category") || "").trim().slice(0, 120);
  const videoId = params.get("id");

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
    filters: { query, categoryId },
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
