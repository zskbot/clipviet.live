// Cloudflare Pages/Workers AppleCMS V10 adapter.
// Upstream access is deny-by-default and requires provider + per-video metadata rights.
// Playback URLs are intentionally stripped; this endpoint exposes metadata only.
const PROVIDERS = [
  { id: "souavzy", name: "Souavzy", envKey: "APPLECMS_SOUAVZY_URL", host: "api.souavzy.vip" },
  { id: "apiyutu", name: "ApiYutu", envKey: "APPLECMS_APIYUTU_URL", host: "apiyutu.com" },
  { id: "lbapi9", name: "LBApi9", envKey: "APPLECMS_LBAPI9_URL", host: "lbapi9.com" },
  { id: "slapibf", name: "Slapibf", envKey: "APPLECMS_SLAPIBF_URL", host: "slapibf.com" },
  { id: "jipinvip1", name: "JipinVIP1", envKey: "APPLECMS_JIPINVIP1_URL", host: "jipinvip1.com" }
];
const RIGHTS_USES = new Set(["metadata_only", "official_embed", "owner_hosted_stream", "redistribute"]);
function parseRegistry(raw) {
  try { const value = JSON.parse(raw || "{}"); return value && typeof value === "object" && !Array.isArray(value) ? value : {}; }
  catch { return {}; }
}
function validHttps(value) {
  try {
    const u = new URL(value);
    return u.protocol === "https:" && !u.username && !u.password && !u.port && !u.hash &&
      u.hostname.includes(".") && u.hostname !== "localhost" && !/^\d{1,3}(?:\.\d{1,3}){3}$/.test(u.hostname);
  } catch { return false; }
}
function unexpired(value) { const n = Date.parse(value || ""); return Number.isFinite(n) && n > Date.now(); }
function providerApproved(record) {
  return record?.approved === true && record?.enabled === true &&
    Boolean(String(record.rightsHolder || "").trim()) && Boolean(String(record.licenseReference || "").trim()) &&
    validHttps(record.evidenceUrl) && validHttps(record.documentationUrl) && unexpired(record.expiresAt) &&
    Array.isArray(record.regions) && (record.regions.includes("GLOBAL") || record.regions.includes("VN")) &&
    ["none", "api_key", "oauth2", "signed_request"].includes(record.authMode);
}
function videoMetadataApproved(record, providerId, itemId) {
  return record?.providerId === providerId && record?.approved === true && record?.enabled === true &&
    Boolean(record.sourceContentId) && validHttps(record.sourceUrl) && validHttps(record.evidenceUrl) &&
    unexpired(record.expiresAt) && record.sourceVerified === true && record.ownershipVerified === true &&
    record.performerAgeVerified === true && record.performerConsentVerified === true &&
    Array.isArray(record.permittedUses) && record.permittedUses.includes("metadata_only") &&
    record.permittedUses.every(use => RIGHTS_USES.has(use)) && Array.isArray(record.regions) &&
    (record.regions.includes("GLOBAL") || record.regions.includes("VN")) &&
    String(record.sourceContentId) === String(itemId);
}
function getProvider(id, env) {
  const provider = PROVIDERS.find(p => p.id === id);
  if (!provider) throw new Error("Unknown provider");
  if (!providerApproved(parseRegistry(env.VIDEO_PROVIDER_RIGHTS_JSON)[id])) throw new Error("Provider rights are not approved");
  const raw = env[provider.envKey];
  if (!raw) throw new Error("Provider is not configured");
  const url = new URL(raw);
  if (url.protocol !== "https:" || url.hostname.toLowerCase() !== provider.host ||
      url.pathname !== "/api.php/provide/vod/" || url.username || url.password || url.port || url.search || url.hash) {
    throw new Error("Provider URL is not allowlisted");
  }
  return { ...provider, baseUrl: url.toString() };
}
function mapMetadata(provider, row, rightsRegistry) {
  const id = String(row?.vod_id ?? "");
  if (!id || !videoMetadataApproved(rightsRegistry[id], provider.id, id)) return null;
  const image = value => validHttps(value) ? value : "";
  return {
    id: provider.id + ":" + id, provider: provider.id,
    title: String(row.vod_name || "").slice(0, 240),
    description: String(row.vod_blurb || row.vod_content || "").slice(0, 2000),
    poster: image(String(row.vod_pic || "")),
    category: String(row.type_name || "").slice(0, 100),
    year: String(row.vod_year || "").slice(0, 8),
    area: String(row.vod_area || "").slice(0, 100),
    language: String(row.vod_lang || "").slice(0, 80),
    publishedAt: String(row.vod_pubdate || "").slice(0, 40),
    updatedAt: String(row.vod_time || "").slice(0, 40),
    playback: { enabled: false, reason: "playback_rights_not_integrated" }
  };
}
async function fetchCatalog(provider, params) {
  const url = new URL(provider.baseUrl);
  for (const [key, value] of Object.entries(params)) if (value !== "") url.searchParams.set(key, String(value));
  const cache = caches.default;
  const cacheKey = new Request(url.toString(), { method: "GET" });
  const cached = await cache.match(cacheKey);
  if (cached) return cached.json();
  const response = await fetch(url, { headers: { accept: "application/json" }, redirect: "error", signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error("Upstream provider unavailable");
  const payload = await response.json();
  if (!payload || Number(payload.code) !== 1 || !Array.isArray(payload.list)) throw new Error("Invalid AppleCMS response");
  await cache.put(cacheKey, new Response(JSON.stringify(payload), {
    headers: { "content-type": "application/json", "cache-control": "public, max-age=0, s-maxage=45" }
  }));
  return payload;
}
export async function listApprovedAppleCmsMetadata(request, env) {
  const url = new URL(request.url), id = url.searchParams.get("provider") || "";
  const page = Math.max(1, Math.min(10000, Number.parseInt(url.searchParams.get("page") || "1", 10) || 1));
  const keyword = (url.searchParams.get("q") || "").trim().slice(0, 100);
  const provider = getProvider(id, env);
  const payload = await fetchCatalog(provider, { ac: "detail", pg: page, wd: keyword });
  const rights = parseRegistry(env.VIDEO_VIDEO_RIGHTS_JSON);
  const items = payload.list.map(row => mapMetadata(provider, row, rights)).filter(Boolean);
  return {
    success: true, provider: { id: provider.id, name: provider.name }, items,
    page: Number(payload.page) || page, total: Number(payload.total) || items.length,
    pageCount: Number(payload.pagecount) || 0,
    rightsGate: { policy: "deny-by-default", metadataOnly: true, playbackEnabled: false }
  };
}
export function appleCmsProviderStatuses(env) {
  const rights = parseRegistry(env.VIDEO_PROVIDER_RIGHTS_JSON);
  return PROVIDERS.map(provider => ({
    id: provider.id, name: provider.name, configured: Boolean(env[provider.envKey]),
    rightsApproved: providerApproved(rights[provider.id]),
    enabled: Boolean(env[provider.envKey]) && providerApproved(rights[provider.id])
  }));
}
