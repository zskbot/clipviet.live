const API_BASE = "https://adultembed.com/api/v1";

const blockedAgeTerms = /(?:\bminor\b|\bunderage\b|\bloli\b|\bshota\b|school\s*(?:girl|boy|student)|teen\s*(?:girl|boy)|học\s*sinh|nữ\s*sinh|nam\s*sinh)/i;

function httpsUrl(value) {
  if (typeof value !== "string" || value.length > 2048) return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.toString() : "";
  } catch {
    return "";
  }
}

export function buildAdultEmbedSearchUrl({ query = "", page = 1, perPage = 20, sort = "newest" } = {}) {
  const url = new URL(API_BASE + "/search");
  const safePage = Math.max(1, Math.min(100000, Number.parseInt(page, 10) || 1));
  const safePerPage = Math.max(1, Math.min(20, Number.parseInt(perPage, 10) || 20));
  const safeSort = ["newest", "oldest", "popular", "longest", "shortest", "updated"].includes(sort) ? sort : "newest";
  const safeQuery = String(query).trim().slice(0, 100);
  if (safeQuery) url.searchParams.set("query", safeQuery);
  url.searchParams.set("page", String(safePage));
  url.searchParams.set("per_page", String(safePerPage));
  url.searchParams.set("sort", safeSort);
  url.searchParams.set("quality", "complete");
  return url;
}

export function normalizeAdultEmbedSearch(payload) {
  if (!payload || typeof payload !== "object" || !Array.isArray(payload.results)) {
    throw new TypeError("AdultEmbed response must contain results[]");
  }
  const results = payload.results.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const id = String(item.id ?? "").trim();
    const title = String(item.title ?? "").trim().slice(0, 240);
    const description = String(item.description ?? "").trim().slice(0, 600);
    if (!id || !/^\d+$/.test(id) || !title || blockedAgeTerms.test([title, description, ...(item.tags || []), ...(item.categories || []).map((x) => x?.name || "")].join(" "))) return [];
    return [{
      id,
      sourceId: "adultembed",
      sourceName: "AdultEmbed",
      title,
      description,
      duration: String(item.duration || "").slice(0, 24),
      durationSeconds: Number.isFinite(Number(item.duration_seconds)) ? Number(item.duration_seconds) : null,
      resolution: String(item.resolution || "").slice(0, 24),
      publishedAt: String(item.published_at || "").slice(0, 40),
      poster: httpsUrl(item.thumbnail || item.poster),
      categories: Array.isArray(item.categories) ? item.categories.map((x) => String(x?.name || "").slice(0, 80)).filter(Boolean).slice(0, 20) : [],
      tags: Array.isArray(item.tags) ? item.tags.map((x) => String(x).slice(0, 80)).slice(0, 30) : [],
      performers: Array.isArray(item.performers) ? item.performers.map((x) => String(x?.name || "").slice(0, 100)).filter(Boolean).slice(0, 20) : [],
      views: Number.isFinite(Number(item.stats?.views)) ? Number(item.stats.views) : 0,
      rightsStatus: "PENDING",
      playbackEnabled: false
    }];
  });
  return {
    page: Math.max(1, Number(payload.page) || 1),
    perPage: Math.max(0, Number(payload.per_page) || results.length),
    total: Math.max(0, Number(payload.total) || 0),
    pages: Math.max(0, Number(payload.pages) || 0),
    results
  };
}

export function adultEmbedIntegrationStatus() {
  return {
    providerId: "adultembed",
    apiBase: API_BASE,
    apiStatus: "DOCUMENTED_NOT_RUNTIME_VERIFIED",
    providerStatus: "PENDING",
    rightsStatus: "UNVERIFIED",
    metadataEnabled: false,
    playbackEnabled: false,
    reason: "Written metadata-use permission and per-title distribution rights have not been verified."
  };
}
