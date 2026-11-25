import { isAllowedApiUrl, isAllowedMediaUrl } from "./embed-security.mjs";

const text = (value, fallback = "") => typeof value === "string" ? value.trim() : fallback;
const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

function safeHttps(value) {
  if (typeof value !== "string" || value.length > 2048) return "";
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" && !url.username && !url.password && !url.port ? url.toString() : "";
  } catch { return ""; }
}

export function parseMacCmsPlayUrl(value) {
  if (typeof value !== "string" || !value.trim()) return [];
  return value.split("$$$").flatMap((route, routeIndex) =>
    route.split("#").flatMap((episode, episodeIndex) => {
      const separator = episode.lastIndexOf("$");
      if (separator < 1 || separator === episode.length - 1) return [];
      const label = episode.slice(0, separator).trim();
      const url = safeHttps(episode.slice(separator + 1).trim());
      if (!url) return [];
      return [{ label: label || `Tập ${episodeIndex + 1}`, url, routeIndex, episodeIndex }];
    })
  );
}

export function normalizeMacCmsItem(item, provider) {
  if (!item || typeof item !== "object") return null;
  const vodId = text(String(item.vod_id ?? ""));
  const title = text(item.vod_name || item.vod_title);
  if (!vodId || !title) return null;
  const play = parseMacCmsPlayUrl(item.vod_play_url || "")[0];
  const mediaUrl = play && isAllowedMediaUrl(play.url, process.env.VIDEO_MEDIA_ALLOWED_HOSTS) ? play.url : "";
  return {
    id: `maccms:${provider.id}:${vodId}`,
    title: title.slice(0, 240),
    description: text(item.vod_content || item.vod_blurb).slice(0, 4000),
    category: text(item.type_name || item.vod_class, "Khác").slice(0, 80),
    year: number(item.vod_year, new Date().getFullYear()),
    duration: text(item.vod_duration || item.vod_remarks, "Chưa cập nhật").slice(0, 40),
    rating: "18+",
    views: number(item.vod_hits, 0),
    poster: safeHttps(item.vod_pic || item.vod_pic_thumb),
    backdrop: safeHttps(item.vod_pic_slide || item.vod_pic),
    videoUrl: mediaUrl,
    embedUrl: "",
    provider: `maccms:${provider.id}`,
    providerName: provider.name,
    sourceId: vodId,
    playLabel: play?.label || ""
  };
}

function configuredProviders(env = process.env) {
  const raw = env.VIDEO_MACCMS_PROVIDERS_JSON || "[]";
  let entries;
  try { entries = JSON.parse(raw); }
  catch { throw new Error("VIDEO_MACCMS_PROVIDERS_JSON must be valid JSON."); }
  if (!Array.isArray(entries)) throw new Error("VIDEO_MACCMS_PROVIDERS_JSON must be an array.");
  return entries.slice(0, 10).flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const id = text(entry.id);
    const name = text(entry.name, id);
    const apiUrl = safeHttps(entry.apiUrl || entry.api_url);
    if (!/^[a-z0-9][a-z0-9_-]{1,39}$/i.test(id) || !apiUrl) return [];
    if (!isAllowedApiUrl(apiUrl, env.VIDEO_API_ALLOWED_HOSTS)) return [];
    return [{ id, name: name.slice(0, 80), apiUrl }];
  });
}

async function requestMacCms(provider, params) {
  const url = new URL(provider.apiUrl);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw new Error(`Provider ${provider.id} returned HTTP ${response.status}`);
  const payload = await response.json();
  if (!payload || typeof payload !== "object" || !Array.isArray(payload.list)) {
    throw new Error(`Provider ${provider.id} returned an invalid MacCMS payload`);
  }
  return payload;
}

export async function getMacCmsFeed(env = process.env) {
  const providers = configuredProviders(env);
  if (!providers.length) return { results: [], providers: [], errors: [] };
  const settled = await Promise.all(providers.map(async provider => {
    try {
      const payload = await requestMacCms(provider, { ac: "list", pg: 1, pagesize: 100 });
      return { provider, results: payload.list.map(item => normalizeMacCmsItem(item, provider)).filter(Boolean), error: null };
    } catch (error) {
      return { provider, results: [], error: error instanceof Error ? error.message : "Provider request failed" };
    }
  }));
  return {
    results: settled.flatMap(item => item.results),
    providers: settled.map(({ provider, results, error }) => ({ id: provider.id, name: provider.name, count: results.length, state: error ? "error" : "ok" })),
    errors: settled.filter(item => item.error).map(item => ({ id: item.provider.id, error: item.error }))
  };
}

export async function getMacCmsVideoById(id, env = process.env) {
  if (typeof id !== "string" || !id.startsWith("maccms:")) return null;
  const [, providerId, vodId] = id.split(":");
  if (!providerId || !vodId) return null;
  const provider = configuredProviders(env).find(item => item.id === providerId);
  if (!provider) return null;
  const payload = await requestMacCms(provider, { ac: "detail", ids: vodId });
  const item = payload.list[0];
  if (!item) return null;
  const normalized = normalizeMacCmsItem(item, provider);
  if (!normalized) return null;
  const playItems = parseMacCmsPlayUrl(item.vod_play_url || "");
  const allowedPlayItems = playItems.filter(play => isAllowedMediaUrl(play.url, env.VIDEO_MEDIA_ALLOWED_HOSTS));
  return {
    ...normalized,
    videoUrl: allowedPlayItems[0]?.url || normalized.videoUrl,
    playItems: allowedPlayItems.map(({ label, url }) => ({ label, url }))
  };
}

export function getMacCmsProviderConfig(env = process.env) {
  return configuredProviders(env).map(({ id, name, apiUrl }) => ({
    id, name, apiHost: new URL(apiUrl).hostname
  }));
}
