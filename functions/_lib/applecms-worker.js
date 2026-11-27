// AppleCMS V10 provider adapter for ClipViet Pages Preview.
// Rights are checked independently at provider and per-video level.
// Metadata endpoints never return source playback URLs.
const PROVIDERS = [
  { id: "souavzy", name: "Souavzy", envKey: "APPLECMS_SOUAVZY_URL", host: "api.souavzy.vip", role: "primary" },
  { id: "apiyutu", name: "ApiYutu", envKey: "APPLECMS_APIYUTU_URL", host: "apiyutu.com", role: "backup" },
  { id: "lbapi9", name: "LBApi9", envKey: "APPLECMS_LBAPI9_URL", host: "lbapi9.com", role: "backup" },
  { id: "slapibf", name: "Slapibf", envKey: "APPLECMS_SLAPIBF_URL", host: "slapibf.com", role: "backup" },
  { id: "jipinvip1", name: "JipinVIP1", envKey: "APPLECMS_JIPINVIP1_URL", host: "jipinvip1.com", role: "backup" }
];
const RIGHTS_USES = new Set(["metadata_only", "official_embed", "owner_hosted_stream", "redistribute"]);
const PLAYBACK_MODES = new Set(["metadata_only", "official_embed", "owner_hosted_stream"]);
const AUTH_MODES = new Set(["none", "api_key", "oauth2", "signed_request"]);
const EXCLUDED_AGE_LABEL = /(?:học[\s_-]*sinh|nữ[\s_-]*sinh|nam[\s_-]*sinh|thiếu[\s_-]*niên|vị[\s_-]*thành[\s_-]*niên|under[\s_-]*age|minor|loli|shota|school[\s_-]*(?:girl|boy|student)|teen[\s_-]*(?:girl|boy))/i;

export class AppleCmsProviderError extends Error {
  constructor(message, status = 502, code = "PROVIDER_ERROR") {
    super(message);
    this.name = "AppleCmsProviderError";
    this.status = status;
    this.code = code;
  }
}
const clean = value => typeof value === "string" ? value.trim() : "";
function parseRegistry(raw) {
  try {
    const value = JSON.parse(raw || "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch { return {}; }
}
function validHttps(value) {
  try {
    const url = new URL(String(value || ""));
    const host = url.hostname.toLowerCase();
    return url.protocol === "https:" && !url.username && !url.password && !url.port && !url.hash &&
      host.includes(".") && host !== "localhost" && !host.endsWith(".local") &&
      !/^(\d{1,3}\.){3}\d{1,3}$/.test(host);
  } catch { return false; }
}
function hostOf(value) {
  try { return new URL(value).hostname.toLowerCase(); } catch { return ""; }
}
function hostAllowed(value, list) {
  const host = hostOf(value);
  return Boolean(host && Array.isArray(list) && list.some(item => clean(item).toLowerCase() === host));
}
function unexpired(value) {
  const timestamp = Date.parse(value || "");
  return Number.isFinite(timestamp) && timestamp > Date.now();
}
function regionsAllow(record) {
  return Array.isArray(record?.regions) &&
    (record.regions.includes("GLOBAL") || record.regions.includes("VN"));
}
function providerApproval(record) {
  return record?.approved === true && record?.enabled === true &&
    Boolean(clean(record.rightsHolder)) && Boolean(clean(record.licenseReference)) &&
    validHttps(record.evidenceUrl) && validHttps(record.documentationUrl) &&
    unexpired(record.expiresAt) && regionsAllow(record) &&
    AUTH_MODES.has(record.authMode) && PLAYBACK_MODES.has(record.playbackMode);
}
function videoApproval(record, providerId, videoId, use) {
  if (!record || record.providerId !== providerId || record.approved !== true || record.enabled !== true) return false;
  if (!clean(record.rightsHolder) || !clean(record.licenseReference) || !clean(record.creator)) return false;
  if (String(record.sourceContentId || "") !== String(videoId)) return false;
  if (!validHttps(record.sourceUrl) || !validHttps(record.evidenceUrl) || !unexpired(record.expiresAt)) return false;
  if (record.sourceVerified !== true || record.ownershipVerified !== true ||
      record.performerAgeVerified !== true || record.performerConsentVerified !== true) return false;
  if (!Array.isArray(record.permittedUses) || !record.permittedUses.includes(use) ||
      record.permittedUses.some(item => !RIGHTS_USES.has(item))) return false;
  return regionsAllow(record);
}
function videoRightsRecord(env, providerId, videoId) {
  const registry = parseRegistry(env.VIDEO_VIDEO_RIGHTS_JSON);
  return registry[providerId + ":" + videoId] || registry[videoId] || null;
}
function getProvider(id, env) {
  const provider = PROVIDERS.find(item => item.id === id);
  if (!provider) throw new AppleCmsProviderError("Unknown provider.", 404, "UNKNOWN_PROVIDER");
  const raw = env[provider.envKey];
  if (!raw) throw new AppleCmsProviderError("Provider API is not configured.", 503, "PROVIDER_NOT_CONFIGURED");
  const rights = parseRegistry(env.VIDEO_PROVIDER_RIGHTS_JSON)[id];
  if (!providerApproval(rights)) {
    throw new AppleCmsProviderError("Provider rights are pending review.", 403, "PROVIDER_RIGHTS_PENDING");
  }
  let url;
  try { url = new URL(raw); } catch {
    throw new AppleCmsProviderError("Provider API URL is invalid.", 503, "PROVIDER_CONFIG_INVALID");
  }
  if (url.protocol !== "https:" || url.hostname.toLowerCase() !== provider.host ||
      url.pathname !== "/api.php/provide/vod/" || url.username || url.password || url.port ||
      url.search || url.hash) {
    throw new AppleCmsProviderError("Provider API URL does not match its fixed host allowlist.", 503, "PROVIDER_CONFIG_INVALID");
  }
  return { ...provider, baseUrl: url.toString(), rights };
}
function safeImage(value) {
  return validHttps(value) ? new URL(value).href : "";
}
function mapMetadata(provider, row, rightsRegistry) {
  const videoId = String(row?.vod_id ?? "").trim();
  const title = String(row?.vod_name || "").trim();
  if (!videoId || !title) return null;
  const record = rightsRegistry[provider.id + ":" + videoId] || rightsRegistry[videoId];
  if (!videoApproval(record, provider.id, videoId, "metadata_only")) return null;
  const description = String(row.vod_blurb || row.vod_content || "").replace(/<[^>]*>/g, " ").trim().slice(0, 4000);
  const searchable = [title, row.type_name, description, row.vod_actor, row.vod_director].join(" ");
  if (EXCLUDED_AGE_LABEL.test(searchable)) return null;
  return {
    id: provider.id + ":" + videoId,
    providerId: provider.id,
    providerName: provider.name,
    sourceContentId: videoId,
    title: title.slice(0, 240),
    description,
    poster: safeImage(row.vod_pic || ""),
    posterThumb: safeImage(row.vod_pic_thumb || ""),
    categoryId: Number(row.type_id) || 0,
    parentCategoryId: Number(row.type_id_1) || 0,
    categoryName: String(row.type_name || "").slice(0, 120),
    category: String(row.type_name || "").slice(0, 120),
    year: String(row.vod_year || "").slice(0, 8),
    area: String(row.vod_area || "").slice(0, 100),
    language: String(row.vod_lang || "").slice(0, 80),
    duration: String(row.vod_duration || "").slice(0, 40),
    publishedAt: String(row.vod_pubdate || "").slice(0, 40),
    updatedAt: String(row.vod_time || "").slice(0, 40),
    views: Number(row.vod_hits) || 0,
    rightsStatus: "METADATA_APPROVED",
    playbackEnabled: false,
    playbackRightsApproved: false,
    playbackEndpoint: "/api/providers/applecms/videos/" + encodeURIComponent(videoId) + "/playback?sourceId=" + encodeURIComponent(provider.id)
  };
}
async function requestAppleCms(provider, params) {
  const url = new URL(provider.baseUrl);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && String(value) !== "") url.searchParams.set(key, String(value));
  }
  const isCategoryRequest = params.ac === "list";
  if (isCategoryRequest) {
    const cached = await caches.default.match(new Request(url.toString(), { method: "GET" }));
    if (cached) return cached.json();
  }
  let response;
  try {
    response = await fetch(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json", "User-Agent": "ClipViet-Preview/1.0" },
      redirect: "error",
      signal: AbortSignal.timeout(15000)
    });
  } catch {
    throw new AppleCmsProviderError("Provider API could not be reached.", 502, "PROVIDER_NETWORK_ERROR");
  }
  if (!response.ok) throw new AppleCmsProviderError("Provider API returned HTTP " + response.status + ".", 502, "PROVIDER_UPSTREAM_ERROR");
  let payload;
  try { payload = await response.json(); } catch {
    throw new AppleCmsProviderError("Provider returned invalid JSON.", 502, "PROVIDER_INVALID_JSON");
  }
  if (!payload || Number(payload.code) !== 1) {
    throw new AppleCmsProviderError("Provider returned an invalid AppleCMS response code.", 502, "PROVIDER_INVALID_RESPONSE");
  }
  if (isCategoryRequest) {
    if (!Array.isArray(payload.class)) throw new AppleCmsProviderError("Provider categories are missing.", 502, "PROVIDER_INVALID_CATEGORIES");
    await caches.default.put(url.toString(), new Response(JSON.stringify(payload), {
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=0, s-maxage=60" }
    }));
  } else if (!Array.isArray(payload.list)) {
    throw new AppleCmsProviderError("Provider video list is missing.", 502, "PROVIDER_INVALID_VIDEOS");
  }
  return payload;
}
function categoriesFromPayload(payload) {
  const rows = (payload.class || []).filter(row => !EXCLUDED_AGE_LABEL.test(String(row.type_name || "")));
  const normalized = rows.map(row => ({
    id: String(row.type_id ?? ""),
    parentId: String(row.type_pid ?? ""),
    name: String(row.type_name || "").trim()
  })).filter(row => row.id && row.name);
  const parentIds = new Set(normalized.map(row => row.parentId).filter(Boolean));
  return normalized.filter(row => !parentIds.has(row.id));
}
function requireVideoMetadata(provider, videoId, row, env) {
  const id = String(row?.vod_id ?? "");
  const rights = parseRegistry(env.VIDEO_VIDEO_RIGHTS_JSON);
  const data = mapMetadata(provider, row, rights);
  if (!data || id !== String(videoId)) {
    throw new AppleCmsProviderError("Video is not approved for metadata display.", 403, "VIDEO_RIGHTS_PENDING");
  }
  return data;
}
function parseAppleCmsLines(row) {
  const names = String(row.vod_play_from || "").split("$$$");
  const groups = String(row.vod_play_url || "").split("$$$");
  return groups.map((group, index) => ({
    name: clean(names[index]) || "Playback " + (index + 1),
    episodes: group.split("#").map((entry, episodeIndex) => {
      const separator = entry.lastIndexOf("$");
      if (separator < 0 || separator === entry.length - 1) return null;
      const url = entry.slice(separator + 1).trim();
      if (!validHttps(url)) return null;
      return { name: clean(entry.slice(0, separator)) || "Episode " + (episodeIndex + 1), url };
    }).filter(Boolean)
  })).filter(line => line.episodes.length);
}
function parseOfficialEmbeds(row, providerRights) {
  const candidate = clean(row.vod_embed || row.embed_url || row.vod_player_url);
  if (!validHttps(candidate) || !hostAllowed(candidate, providerRights.embedHosts)) return [];
  return [{ name: "Official embed", url: new URL(candidate).href }];
}
function playbackPayload(provider, row, videoId, env) {
  const rights = videoRightsRecord(env, provider.id, videoId);
  const mode = provider.rights.playbackMode;
  const use = mode === "official_embed" ? "official_embed" : "owner_hosted_stream";
  if (mode === "metadata_only" || !videoApproval(rights, provider.id, videoId, use)) {
    throw new AppleCmsProviderError("Playback is not approved for this video.", 403, "PLAYBACK_RIGHTS_PENDING");
  }
  if (mode === "official_embed") {
    const embeds = parseOfficialEmbeds(row, provider.rights);
    if (!embeds.length) throw new AppleCmsProviderError("No approved official embed URL was supplied.", 403, "OFFICIAL_EMBED_NOT_AVAILABLE");
    return { providerId: provider.id, videoId: String(videoId), playbackMode: mode, sources: embeds };
  }
  const mediaHosts = provider.rights.mediaHosts;
  const lines = parseAppleCmsLines(row).map(line => ({
    name: line.name,
    episodes: line.episodes.filter(ep => hostAllowed(ep.url, mediaHosts)).map(ep => ({ name: ep.name, url: ep.url }))
  })).filter(line => line.episodes.length);
  if (!lines.length) throw new AppleCmsProviderError("No owner-hosted media URL matches the approved host list.", 403, "MEDIA_HOST_NOT_APPROVED");
  return { providerId: provider.id, videoId: String(videoId), playbackMode: mode, delivery: "direct-browser", sources: lines };
}
function activeProviderState(provider) {
  return {
    id: provider.id, name: provider.name, role: provider.role,
    configured: true, rightsApproved: true,
    playbackMode: provider.rights.playbackMode,
    status: provider.rights.playbackMode === "metadata_only" ? "METADATA_ONLY" : "PLAYBACK_APPROVED",
    operationalState: "ACTIVE"
  };
}
export function appleCmsProviderStatuses(env = {}) {
  const rightsRegistry = parseRegistry(env.VIDEO_PROVIDER_RIGHTS_JSON);
  return PROVIDERS.map(provider => {
    const configured = Boolean(env[provider.envKey]);
    const rights = rightsRegistry[provider.id];
    const approved = providerApproval(rights);
    let status = !configured ? "NOT_CONFIGURED" : !approved ? "PENDING_RIGHTS" :
      rights.playbackMode === "metadata_only" ? "METADATA_ONLY" : "PLAYBACK_APPROVED";
    return {
      id: provider.id, name: provider.name, role: provider.role,
      protocol: "AppleCMS V10", endpoint: "https://" + provider.host + "/api.php/provide/vod/",
      configured, rightsApproved: approved, playbackMode: approved ? rights.playbackMode : "none",
      status, operationalState: "NOT_CHECKED"
    };
  });
}
export async function listAppleCmsCategories(request, env) {
  const url = new URL(request.url);
  const id = url.searchParams.get("sourceId") || url.searchParams.get("provider") || "";
  if (!id) throw new AppleCmsProviderError("sourceId is required.", 400, "SOURCE_ID_REQUIRED");
  const provider = getProvider(id, env);
  const payload = await requestAppleCms(provider, { ac: "list" });
  return { success: true, provider: activeProviderState(provider), categories: categoriesFromPayload(payload), rightsGate: { policy: "deny-by-default", metadataOnly: provider.rights.playbackMode === "metadata_only" } };
}
export async function listAppleCmsVideos(request, env) {
  const url = new URL(request.url);
  const id = url.searchParams.get("sourceId") || url.searchParams.get("provider") || "";
  if (!id) throw new AppleCmsProviderError("sourceId is required.", 400, "SOURCE_ID_REQUIRED");
  const provider = getProvider(id, env);
  const page = Math.max(1, Math.min(100000, Number.parseInt(url.searchParams.get("page") || "1", 10) || 1));
  const limit = Math.max(1, Math.min(100, Number.parseInt(url.searchParams.get("limit") || "30", 10) || 30));
  const params = { ac: "list", pg: page, pagesize: limit };
  const category = clean(url.searchParams.get("categoryId"));
  const keyword = clean(url.searchParams.get("keyword") || url.searchParams.get("wd")).slice(0, 100);
  if (category) params.t = category.slice(0, 20);
  if (keyword) params.wd = keyword;
  const payload = await requestAppleCms(provider, params);
  const rights = parseRegistry(env.VIDEO_VIDEO_RIGHTS_JSON);
  const items = payload.list.map(row => mapMetadata(provider, row, rights)).filter(Boolean);
  return {
    success: true, provider: { id, name: provider.name, status: "ACTIVE" },
    items, page: Number(payload.page) || page, pageCount: Number(payload.pagecount) || 0,
    total: Number(payload.total) || items.length, limit: Number(payload.limit) || limit,
    catalogMode: provider.rights.playbackMode === "metadata_only" ? "metadata-only" : "rights-scoped"
  };
}
export async function getAppleCmsVideoDetail(request, env, params = {}) {
  const url = new URL(request.url);
  const id = params.sourceId || url.searchParams.get("sourceId") || url.searchParams.get("provider") || "";
  const videoId = String(params.videoId || url.searchParams.get("videoId") || url.searchParams.get("vodId") || "").trim();
  if (!id || !/^[0-9]+$/.test(videoId)) throw new AppleCmsProviderError("Valid sourceId and videoId are required.", 400, "INVALID_VIDEO_REFERENCE");
  const provider = getProvider(id, env);
  const payload = await requestAppleCms(provider, { ac: "detail", ids: videoId });
  const row = payload.list.find(item => String(item.vod_id) === videoId);
  if (!row) throw new AppleCmsProviderError("Video was not found.", 404, "VIDEO_NOT_FOUND");
  const data = requireVideoMetadata(provider, videoId, row, env);
  return { success: true, provider: activeProviderState(provider), data, playback: { enabled: false, endpoint: data.playbackEndpoint, reason: "PLAYBACK_ENDPOINT_REQUIRES_PER_VIDEO_APPROVAL" } };
}
export async function getAppleCmsPlaybackInfo(request, env, params = {}) {
  const url = new URL(request.url);
  const id = params.sourceId || url.searchParams.get("sourceId") || url.searchParams.get("provider") || "";
  const videoId = String(params.videoId || url.searchParams.get("videoId") || url.searchParams.get("vodId") || "").trim();
  if (!id || !/^[0-9]+$/.test(videoId)) throw new AppleCmsProviderError("Valid sourceId and videoId are required.", 400, "INVALID_VIDEO_REFERENCE");
  const provider = getProvider(id, env);
  const payload = await requestAppleCms(provider, { ac: "detail", ids: videoId });
  const row = payload.list.find(item => String(item.vod_id) === videoId);
  if (!row) throw new AppleCmsProviderError("Video was not found.", 404, "VIDEO_NOT_FOUND");
  requireVideoMetadata(provider, videoId, row, env);
  return { success: true, provider: activeProviderState(provider), data: playbackPayload(provider, row, videoId, env), rightsGate: { policy: "deny-by-default", providerApproved: true, perVideoApproved: true } };
}
