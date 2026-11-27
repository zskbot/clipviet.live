const PROVIDERS = [
  { id: "souavzy", name: "Souavzy · Main", role: "primary", envKey: "APPLECMS_SOUAVZY_URL", host: "api.souavzy.vip", enabled: true },
  { id: "apiyutu", name: "ApiYutu · Backup 1", role: "backup", envKey: "APPLECMS_APIYUTU_URL", host: "apiyutu.com", enabled: true },
  { id: "lbapi9", name: "LBApi9 · Backup 2", role: "backup", envKey: "APPLECMS_LBAPI9_URL", host: "lbapi9.com", enabled: true },
  { id: "slapibf", name: "Slapibf · Backup 3", role: "backup", envKey: "APPLECMS_SLAPIBF_URL", host: "slapibf.com", enabled: true },
  { id: "jipinvip1", name: "JipinVIP1 · Backup 4", role: "backup", envKey: "APPLECMS_JIPINVIP1_URL", host: "jipinvip1.com", enabled: true }
];
const USER_AGENT = "Mozilla/5.0 (compatible; ClipVietProvider/1.0; +https://clipviet.live)";
const REQUEST_TIMEOUT_MS = 15000;
const RETRY_DELAY_MS = 500;
const CACHE_TTL_SECONDS = 60;
const providerQueues = new Map();
const lastProviderRequestAt = new Map();
async function withProviderThrottle(providerId, operation) {
  const previous = providerQueues.get(providerId) || Promise.resolve();
  let release;
  const current = new Promise(resolve => { release = resolve; });
  providerQueues.set(providerId, current);
  await previous;
  try {
    const elapsed = Date.now() - (lastProviderRequestAt.get(providerId) || 0);
    if (elapsed < 200) await new Promise(resolve => setTimeout(resolve, 200 - elapsed));
    lastProviderRequestAt.set(providerId, Date.now());
    return await operation();
  } finally {
    release();
    if (providerQueues.get(providerId) === current) providerQueues.delete(providerId);
  }
}

export class ProviderError extends Error {
  constructor(providerId, message, status = 502) {
    super(message);
    this.name = "ProviderError";
    this.providerId = providerId;
    this.status = status;
  }
}
export function listProviders(env) {
  return PROVIDERS.filter(p => p.enabled).map(({ id, name, role, envKey }) => ({ id, name, role, protocol: "AppleCMS V10", configured: Boolean(env?.[envKey]) }));
}
function safeEvidenceUrl(value) {
  try { const url = new URL(String(value || "")); return url.protocol === "https:" && !url.username && !url.password && !url.port && url.hostname.includes("."); }
  catch { return false; }
}
function parseJsonArray(value) {
  try { const parsed = JSON.parse(value || "[]"); return Array.isArray(parsed) ? parsed : []; }
  catch { return []; }
}
async function getProvider(id, env) {
  const configured = PROVIDERS.find(p => p.id === id && p.enabled);
  if (!configured) throw new ProviderError(String(id || ""), "Unknown or disabled provider", 404);
  const raw = env?.[configured.envKey];
  if (!raw) throw new ProviderError(configured.id, "Provider URL is not configured", 503);
  let url;
  try { url = new URL(raw); } catch { throw new ProviderError(configured.id, "Provider URL is invalid", 503); }
  if (url.protocol !== "https:" || url.hostname.toLowerCase() !== configured.host || url.pathname !== "/api.php/provide/vod/" || url.username || url.password || url.search || url.hash) throw new ProviderError(configured.id, "Provider URL does not match the approved AppleCMS endpoint", 503);
  if (!env?.PROVIDER_DB) throw new ProviderError(configured.id, "Rights registry is unavailable; catalog access is blocked.", 503);
  const approval = await env.PROVIDER_DB.prepare("SELECT p.status AS provider_status,p.rights_holder,p.license_reference,p.rights_evidence_url,p.license_expires_at,c.status AS connector_status,c.playback_mode,c.regions_json FROM provider_registry p JOIN provider_connectors c ON c.provider_id=p.id WHERE p.id=? LIMIT 1").bind(configured.id).first();
  const regions = parseJsonArray(approval?.regions_json).map(value => String(value).toUpperCase());
  const expiry = Date.parse(approval?.license_expires_at || "");
  const providerApproved = approval && ["APPROVED", "ENABLED"].includes(approval.provider_status) &&
    approval.connector_status === "APPROVED" && Boolean(String(approval.rights_holder || "").trim()) &&
    Boolean(String(approval.license_reference || "").trim()) && safeEvidenceUrl(approval.rights_evidence_url) &&
    Number.isFinite(expiry) && expiry > Date.now() && (regions.includes("GLOBAL") || regions.includes("VN"));
  if (!providerApproved) throw new ProviderError(configured.id, "Provider rights are pending legal approval.", 403);
  return { ...configured, baseUrl: url.toString(), playbackMode: approval.playback_mode, approvedRegions: regions };
}
async function getApprovedContentRights(provider, env) {
  const now = new Date().toISOString();
  const result = await env.PROVIDER_DB.prepare("SELECT source_content_id,source_url,rights_holder,license_reference,evidence_url,license_expires_at,permitted_uses_json,regions_json,source_verified,ownership_verified,performer_age_verified,performer_consent_verified FROM provider_content_rights WHERE provider_id=? AND status='APPROVED' AND license_expires_at>? AND source_verified=1 AND ownership_verified=1 AND performer_age_verified=1 AND performer_consent_verified=1 ORDER BY updated_at DESC LIMIT 10000").bind(provider.id, now).all();
  const approved = new Map();
  for (const row of result.results || []) {
    const id = String(row.source_content_id || "");
    const uses = parseJsonArray(row.permitted_uses_json).map(value => String(value));
    const regions = parseJsonArray(row.regions_json).map(value => String(value).toUpperCase());
    if (!id || !safeEvidenceUrl(row.source_url) || !safeEvidenceUrl(row.evidence_url) ||
        !String(row.rights_holder || "").trim() || !String(row.license_reference || "").trim() ||
        !uses.some(value => ["metadata_only", "official_embed", "owner_hosted_stream", "redistribute"].includes(value)) ||
        !(regions.includes("GLOBAL") || regions.includes("VN"))) continue;
    approved.set(id, { uses, regions, expiresAt: row.license_expires_at });
  }
  return approved;
}
function withApprovedRights(video, rights) {
  return { ...video, rightsStatus: "APPROVED", rightsVerified: true,
    rightsPermittedUses: rights.uses, rightsExpiresAt: rights.expiresAt,
    lines: [], playbackEnabled: false };
}
export function parsePlayUrls(raw, playFrom) {
  if (!raw) return [];
  const froms = String(playFrom || "").split("$$$");
  return String(raw).split("$$$").map((line, li) => ({
    lineName: froms[li] || "线路" + (li + 1),
    episodes: line.split("#").filter(Boolean).map((segment, i) => {
      const pos = segment.lastIndexOf("$");
      const name = pos > -1 ? segment.slice(0, pos) : "";
      const url = pos > -1 ? segment.slice(pos + 1) : segment;
      let safeUrl = "";
      try {
        const parsed = new URL(url);
        if (parsed.protocol === "https:" && !parsed.username && !parsed.password) safeUrl = parsed.href;
      } catch {}
      return { index: i, name: name || "第 " + (i + 1) + " 集", url: safeUrl };
    }).filter(ep => ep.url)
  })).filter(line => line.episodes.length);
}
export function mapVideo(provider, row) {
  const sourceId = String(row.vod_id ?? "");
  if (!sourceId) return null;
  const rawDescription = String(row.vod_content || "");
  const blurb = String(row.vod_blurb || "");
  return {
    uid: provider.id + ":" + sourceId,
    id: sourceId,
    sourceId: provider.id,
    sourceName: provider.name,
    title: String(row.vod_name || ""),
    categoryId: Number(row.type_id) || 0,
    parentCategoryId: Number(row.type_id_1) || 0,
    categoryName: String(row.type_name || ""),
    poster: String(row.vod_pic || ""),
    posterThumb: String(row.vod_pic_thumb || ""),
    posterSlide: String(row.vod_pic_slide || ""),
    screenshotsRaw: String(row.vod_pic_screenshot || ""),
    year: String(row.vod_year || ""),
    area: String(row.vod_area || ""),
    language: String(row.vod_lang || ""),
    remarks: String(row.vod_remarks || ""),
    duration: String(row.vod_duration || ""),
    actors: String(row.vod_actor || ""),
    director: String(row.vod_director || ""),
    description: rawDescription.trim() ? rawDescription : blurb,
    blurb,
    publishedAt: String(row.vod_pubdate || ""),
    updatedAt: String(row.vod_time || ""),
    views: Number(row.vod_hits) || 0,
    score: String(row.vod_score || ""),
    playFrom: String(row.vod_play_from || ""),
    playServer: String(row.vod_play_server || ""),
    lines: parsePlayUrls(row.vod_play_url, row.vod_play_from)
  };
}
async function fetchProviderJson(provider, params) {
  const url = new URL(provider.baseUrl);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && String(value) !== "") url.searchParams.set(key, String(value));
  }
  const cacheKey = new Request(url.toString(), { method: "GET" });
  const cache = caches.default;
  const cached = await cache.match(cacheKey);
  if (cached) return cached.json();

  let lastError;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await withProviderThrottle(provider.id, () => fetch(url.toString(), {
        method: "GET",
        headers: { "user-agent": USER_AGENT, accept: "application/json" },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        redirect: "error"
      }));
      if (!response.ok) throw new Error("Provider HTTP " + response.status);
      const payload = await response.json();
      if (!payload || Number(payload.code) !== 1 || !Array.isArray(payload.list) && !Array.isArray(payload.class)) {
        throw new Error("Provider returned an invalid AppleCMS response");
      }
      const cacheResponse = new Response(JSON.stringify(payload), {
        headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=0, s-maxage=" + CACHE_TTL_SECONDS }
      });
      await cache.put(cacheKey, cacheResponse);
      return payload;
    } catch (error) {
      lastError = error;
      if (attempt === 0) await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }
  console.warn("applecms_provider_failed", { providerId: provider.id, reason: lastError instanceof Error ? lastError.message : "unknown" });
  throw new ProviderError(provider.id, "Provider request failed", 502);
}
export async function getProviderCategories(providerId, env) {
  const provider = await getProvider(providerId, env);
  const payload = await fetchProviderJson(provider, { ac: "list" });
  const all = (payload.class || []).map(item => ({
    id: Number(item.type_id) || 0,
    parentId: Number(item.type_pid) || 0,
    name: String(item.type_name || "")
  })).filter(item => item.id && item.name);
  const parentIds = new Set(all.map(item => item.parentId).filter(Boolean));
  return all.filter(item => !parentIds.has(item.id));
}
export async function listProviderVideos(providerId, options = {}, env) {
  const provider = await getProvider(providerId, env);
  const approvedRights = await getApprovedContentRights(provider, env);
  const page = Math.max(1, Math.min(1000000, Number.parseInt(options.page, 10) || 1));
  const pageSize = 30, eligible = [...approvedRights.entries()], total = eligible.length;
  const pageCount = Math.ceil(total / pageSize);
  const selected = eligible.slice((page - 1) * pageSize, page * pageSize);
  if (!selected.length) return {
    provider: { id: provider.id, name: provider.name }, items: [], page, pageCount, total, limit: pageSize,
    rightsGate: { policy: "deny-by-default", providerApproved: true, approvedCount: total, playbackEnabled: false }
  };
  const ids = selected.map(([id]) => id);
  const params = { ac: "detail", ids: ids.join(",") };
  if (options.keyword) params.wd = String(options.keyword).trim().slice(0, 100);
  const payload = await fetchProviderJson(provider, params);
  const items = (payload.list || []).map(row => mapVideo(provider, row)).filter(Boolean)
    .filter(video => approvedRights.has(String(video.id)))
    .map(video => withApprovedRights(video, approvedRights.get(String(video.id))));
  return {
    provider: { id: provider.id, name: provider.name }, items, page, pageCount, total, limit: pageSize,
    rightsGate: { policy: "deny-by-default", providerApproved: true, approvedCount: total, returnedCount: items.length, playbackEnabled: false }
  };
}
export async function getProviderVideo(providerId, vodId, env) {
  const provider = await getProvider(providerId, env);
  const id = String(vodId || "").trim().slice(0, 40);
  if (!/^[0-9]+$/.test(id)) throw new ProviderError(provider.id, "Invalid video ID", 400);
  const approvedRights = await getApprovedContentRights(provider, env);
  const rights = approvedRights.get(id);
  if (!rights) return null;
  const payload = await fetchProviderJson(provider, { ac: "detail", ids: id });
  const row = (payload.list || []).find(item => String(item.vod_id) === id);
  const video = row ? mapVideo(provider, row) : null;
  return video ? withApprovedRights(video, rights) : null;
}
export async function checkProviderHealth(providerId, env) {
  const started = Date.now();
  try {
    const provider = await getProvider(providerId, env);
    const categories = await getProviderCategories(providerId, env);
    const page = await listProviderVideos(providerId, { page: 1 }, env);
    const playbackUrlsPresent = page.items.some(item => item.lines.some(line => line.episodes.length > 0));
    return {
      id: provider.id, name: provider.name, status: page.items.length > 0 && categories.length > 0 && playbackUrlsPresent ? "api-ok" : "degraded",
      latencyMs: Date.now() - started, categoryCount: categories.length,
      pageCount: page.pageCount, total: page.total, sampleCount: page.items.length,
      playbackUrlsPresent
    };
  } catch (error) {
    const provider = PROVIDERS.find(item => item.id === providerId);
    return { id: providerId, name: provider?.name || providerId, status: error?.status === 503 ? "not-configured" : "offline", latencyMs: Date.now() - started };
  }
}
export async function checkAllProviderHealth(env) {
  const results = [];
  for (const provider of PROVIDERS.filter(item => item.enabled)) {
    results.push(await checkProviderHealth(provider.id, env));
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  return results;
}
