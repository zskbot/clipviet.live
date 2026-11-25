export const ADULT_EMBED_API = "https://adultembed.com/api/v1";
const TRUSTED_EMBED_HOSTS = new Set(["adultembed.com", "www.adultembed.com", "pornalizer.app"]);
const TRUSTED_IMAGE_HOSTS = new Set(["adultembed.com", "www.adultembed.com", "pornalizer.app"]);

function text(value, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function safeRemoteUrl(value, hosts) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port || url.hash) return "";
    if (!hosts.has(url.hostname.toLowerCase())) return "";
    return url.href;
  } catch { return ""; }
}
function parseDuration(value) {
  if (typeof value !== "string" || !/^\d{1,3}:\d{2}(?::\d{2})?$/.test(value)) return null;
  const parts = value.split(":").map(Number);
  return parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + parts[1];
}

export function normalizeAdultEmbedVideo(item) {
  if (!item || typeof item !== "object" || Array.isArray(item)) return null;
  const id = Number(item.id);
  const title = text(item.title, 240);
  if (!Number.isSafeInteger(id) || id <= 0 || !title) return null;
  const durationSeconds = Number.isFinite(item.duration_seconds)
    ? Math.max(0, Math.floor(item.duration_seconds))
    : parseDuration(item.duration);
  const categories = Array.isArray(item.categories)
    ? item.categories.map(category => text(category?.name || category?.slug, 80)).filter(Boolean).slice(0, 20)
    : [];
  const tags = Array.isArray(item.tags)
    ? item.tags.map(tag => text(tag, 80)).filter(Boolean).slice(0, 40)
    : [];
  return {
    id: String(id),
    provider: "adultembed",
    title,
    thumbnail: safeRemoteUrl(item.thumbnail || item.poster, TRUSTED_IMAGE_HOSTS),
    durationSeconds,
    duration: text(item.duration, 24) || (durationSeconds === null ? "" : new Date(durationSeconds * 1000).toISOString().slice(11, 19)),
    tags,
    categories,
    embedUrl: safeRemoteUrl(item.embed?.url, TRUSTED_EMBED_HOSTS),
    publishedAt: text(item.published_at, 40),
    description: text(item.description, 600)
  };
}

export function normalizeAdultEmbedSearch(payload) {
  if (!payload || typeof payload !== "object" || !Array.isArray(payload.results)) {
    throw new Error("AdultEmbed response must contain a results array.");
  }
  return {
    total: Number.isFinite(payload.total) ? payload.total : payload.results.length,
    page: Number.isFinite(payload.page) ? payload.page : 1,
    nextPage: Number.isFinite(payload.next_page) ? payload.next_page : null,
    results: payload.results.map(normalizeAdultEmbedVideo).filter(Boolean)
  };
}

export function buildAdultEmbedSearchUrl(query = "", page = 1, perPage = 12) {
  const url = new URL(ADULT_EMBED_API + "/search");
  const q = text(query, 100);
  if (q) url.searchParams.set("query", q);
  url.searchParams.set("orientation", "all");
  url.searchParams.set("quality", "complete");
  url.searchParams.set("sort", "newest");
  url.searchParams.set("page", String(Math.max(1, Math.floor(page))));
  url.searchParams.set("per_page", String(Math.min(20, Math.max(1, Math.floor(perPage)))));
  return url.href;
}

export async function adultEmbedRequest(path, fetchImpl = fetch) {
  if (typeof path !== "string" || !path.startsWith("/") || path.startsWith("//")) {
    throw new Error("Only fixed AdultEmbed API paths are allowed.");
  }
  const url = new URL(ADULT_EMBED_API + path);
  if (url.origin !== "https://adultembed.com") throw new Error("Unexpected API origin.");
  const response = await fetchImpl(url.href, {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "omit",
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(12000)
  });
  if (!response.ok) throw new Error("AdultEmbed API returned HTTP " + response.status + ".");
  const type = response.headers.get("content-type") || "";
  if (!type.toLowerCase().includes("json")) throw new Error("AdultEmbed API did not return JSON.");
  const length = Number(response.headers.get("content-length") || 0);
  if (length > 1024 * 1024) throw new Error("AdultEmbed response exceeds 1 MB.");
  const payload = await response.json();
  if (JSON.stringify(payload).length > 1024 * 1024) throw new Error("AdultEmbed response exceeds 1 MB.");
  return payload;
}
