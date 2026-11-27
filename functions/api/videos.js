import { appleCmsProviderStatuses, listAppleCmsVideos, AppleCmsProviderError } from "../_lib/applecms-worker.js";
const PROVIDER_IDS = ["souavzy", "apiyutu", "lbapi9", "slapibf", "jipinvip1"];
const ALLOW = "GET, HEAD, OPTIONS";
const headers = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "allow": ALLOW, "x-content-type-options": "nosniff" };
const json = (body, status = 200, method = "GET") => new Response(method === "HEAD" ? null : JSON.stringify(body), { status, headers });
export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method !== "GET" && request.method !== "HEAD") return json({ success: false, error: "Method not allowed", code: "METHOD_NOT_ALLOWED" }, 405);
  const rawPage = url.searchParams.get("page") ?? url.searchParams.get("currentPage") ?? "1";
  const rawLimit = url.searchParams.get("limit") ?? url.searchParams.get("pageSize") ?? url.searchParams.get("per_page") ?? "20";
  if (!/^[0-9]+$/.test(rawPage) || !/^[0-9]+$/.test(rawLimit)) return json({ success: false, error: "Invalid pagination", code: "INVALID_PAGINATION" }, 400, request.method);
  const page = Number(rawPage), limit = Number(rawLimit);
  if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) return json({ success: false, error: "Pagination must use a positive page and a limit between 1 and 100", code: "INVALID_PAGINATION" }, 400, request.method);
  if ((url.searchParams.get("id") || "").trim()) return json({ success: false, error: "Use the provider detail endpoint for an individual video.", code: "USE_PROVIDER_DETAIL_ENDPOINT" }, 400, request.method);
  const query = (url.searchParams.get("keyword") || url.searchParams.get("q") || url.searchParams.get("search") || "").trim().slice(0, 100);
  const categoryId = (url.searchParams.get("categoryId") || url.searchParams.get("category") || "").trim().slice(0, 80);
  const providerStates = appleCmsProviderStatuses(env);
  const eligible = providerStates.filter(provider => PROVIDER_IDS.includes(provider.id) && provider.configured && provider.rightsApproved);
  const settled = await Promise.all(eligible.map(async provider => {
    const params = new URLSearchParams({ sourceId: provider.id, page: String(page), limit: "100" });
    if (categoryId) params.set("categoryId", categoryId);
    if (query) params.set("keyword", query);
    try {
      const payload = await listAppleCmsVideos(new Request("https://clipviet-preview.invalid/api/providers/applecms/videos?" + params), env);
      return { id: provider.id, status: "ACTIVE", operationalState: "ACTIVE", items: payload.items || [] };
    } catch (error) {
      return { id: provider.id, status: error instanceof AppleCmsProviderError && error.status === 403 ? "PENDING_RIGHTS" : "ERROR",
        operationalState: error instanceof AppleCmsProviderError && error.status === 403 ? "NOT_CHECKED" : "ERROR",
        items: [], errorCode: error.code || "PROVIDER_ERROR" };
    }
  }));
  const byId = new Map();
  for (const source of settled) for (const item of source.items) if (item?.id && !byId.has(item.id)) byId.set(item.id, item);
  const allItems = [...byId.values()];
  const items = allItems.slice((page - 1) * limit, page * limit);
  const providers = providerStates.map(provider => {
    const live = settled.find(item => item.id === provider.id);
    return { ...provider, catalogCount: live?.items.length ?? 0,
      ...(live?.errorCode ? { errorCode: live.errorCode } : {}),
      catalogState: live ? live.status : provider.configured && provider.rightsApproved ? "NOT_CHECKED" : provider.configured ? "PENDING_RIGHTS" : "NOT_CONFIGURED" };
  });
  const hasPending = providers.some(item => item.status === "PENDING_RIGHTS");
  const hasErrors = providers.some(item => item.catalogState === "ERROR");
  const catalogState = items.length ? "READY" : hasErrors ? "PROVIDERS_UNAVAILABLE" : hasPending ? "RIGHTS_PENDING" : eligible.length ? "EMPTY" : "NO_APPROVED_PROVIDERS";
  const message = items.length ? null : catalogState === "RIGHTS_PENDING" || catalogState === "NO_APPROVED_PROVIDERS"
    ? "Catalog is empty because provider and per-title metadata rights have not been approved. No demo items are inserted."
    : catalogState === "PROVIDERS_UNAVAILABLE" ? "Approved providers could not be reached. Check provider status." : "No rights-approved metadata items were returned for this page.";
  return json({ success: true, endpoint: "/api/videos", source: "applecms-rights-gated-preview", catalogState, message,
    results: items, items, total: allItems.length, page, limit, pageCount: allItems.length ? Math.ceil(allItems.length / limit) : 0,
    query, category: categoryId, categoryId, filters: { query, categoryId }, providers,
    providerErrors: settled.filter(item => item.errorCode).map(item => ({ id: item.id, code: item.errorCode })),
    rightsGate: { policy: "deny-by-default", providerAndPerVideoApprovalRequired: true, externalWebsiteScrapingEnabled: false, publicPlaybackEnabled: false }
  }, 200, request.method);
}