/**
 * AppleCMS V10 metadata adapter.
 * Pure fixture adapter: not connected to live routes, crawlers, or players.
 */

const EXCLUDED_AGE_LABEL = /(?:học[\s_-]*sinh|nữ[\s_-]*sinh|nam[\s_-]*sinh|thiếu[\s_-]*niên|vị[\s_-]*thành[\s_-]*niên|under[\s_-]*age|minor|loli|shota|school[\s_-]*(?:girl|boy|student)|teen[\s_-]*(?:girl|boy))/i;

export class ProviderRightsPendingError extends Error {
  constructor(providerId) {
    super("Provider rights approval is pending: " + providerId);
    this.name = "ProviderRightsPendingError";
    this.code = "PROVIDER_RIGHTS_PENDING";
  }
}

export function assertProviderApproved(providerId, approvedProviderIds = []) {
  const approved = approvedProviderIds instanceof Set
    ? approvedProviderIds
    : new Set(Array.isArray(approvedProviderIds) ? approvedProviderIds : []);
  if (!approved.has(String(providerId || ""))) {
    throw new ProviderRightsPendingError(String(providerId || "unknown"));
  }
  return true;
}

export function normalizeAppleCmsPayload(payload, collection = "list") {
  if (!payload || typeof payload !== "object" || Number(payload.code) !== 1) {
    throw new Error("Invalid AppleCMS response code");
  }
  const rows = payload[collection];
  if (!Array.isArray(rows)) throw new Error("Invalid AppleCMS collection: " + collection);
  return rows;
}

export function mapAppleCmsCategories(rows) {
  if (!Array.isArray(rows)) return [];
  const seen = new Set();
  return rows
    .filter((row) => Number(row?.type_pid) > 0)
    .map((row) => ({
      id: String(row?.type_id ?? "").trim(),
      parentId: String(row?.type_pid ?? "").trim(),
      name: String(row?.type_name ?? "").trim()
    }))
    .filter((item) => {
      if (!item.id || !item.name || seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
}

/**
 * Parse line/episode labels for display only. Media URLs are discarded;
 * this adapter cannot activate playback.
 */
export function parseAppleCmsPlayManifest(playFrom, playUrl) {
  const sources = String(playFrom || "").split("$$$");
  const lines = String(playUrl || "").split("$$$");
  return lines.flatMap((line, lineIndex) => {
    const episodes = String(line || "").split("#").flatMap((entry, episodeIndex) => {
      const separator = entry.lastIndexOf("$");
      if (separator < 0) return [];
      const name = entry.slice(0, separator).trim() || ("Episode " + (episodeIndex + 1));
      const rawUrl = entry.slice(separator + 1).trim();
      if (!rawUrl) return [];
      return [{ name }];
    });
    return episodes.length
      ? [{ lineName: String(sources[lineIndex] || ("Line " + (lineIndex + 1))).trim(), episodes }]
      : [];
  });
}

function safeHttpsUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" && !url.username && !url.password ? url.href : "";
  } catch {
    return "";
  }
}

export function mapAppleCmsVideo(row, { sourceId, sourceName } = {}) {
  if (!row || typeof row !== "object") return null;
  const id = String(row.vod_id ?? "").trim();
  const title = String(row.vod_name ?? "").trim();
  if (!id || !title) return null;

  const item = {
    uid: String(sourceId || "unknown") + ":" + id,
    id,
    sourceId: String(sourceId || "unknown"),
    sourceName: String(sourceName || sourceId || "Unknown source"),
    title,
    categoryId: Number(row.type_id) || 0,
    parentCategoryId: Number(row.type_id_1) || 0,
    categoryName: String(row.type_name || "").trim(),
    poster: safeHttpsUrl(row.vod_pic),
    year: String(row.vod_year || "").trim(),
    area: String(row.vod_area || "").trim(),
    language: String(row.vod_lang || "").trim(),
    remarks: String(row.vod_remarks || "").trim(),
    duration: String(row.vod_duration || "").trim(),
    actors: String(row.vod_actor || "").trim(),
    director: String(row.vod_director || "").trim(),
    description: String(row.vod_content || row.vod_blurb || "").replace(/<[^>]*>/g, " ").trim().slice(0, 4000),
    publishedAt: String(row.vod_pubdate || "").trim(),
    updatedAt: String(row.vod_time || "").trim(),
    views: Number(row.vod_hits) || 0,
    score: String(row.vod_score || "").trim(),
    lines: parseAppleCmsPlayManifest(row.vod_play_from, row.vod_play_url),
    playbackEnabled: false,
    rightsStatus: "PENDING"
  };

  const searchable = [item.title, item.categoryName, item.description, item.actors, item.director].join(" ");
  if (EXCLUDED_AGE_LABEL.test(searchable)) return null;
  return item;
}

/**
 * Failover helper requires an explicit reviewed allowlist. Empty results are
 * valid responses and do not trigger failover.
 */
export async function runApprovedProviderFailover(providerIds, approvedProviderIds, operation) {
  const approved = approvedProviderIds instanceof Set
    ? approvedProviderIds
    : new Set(Array.isArray(approvedProviderIds) ? approvedProviderIds : []);
  const eligible = (Array.isArray(providerIds) ? providerIds : []).filter((id) => approved.has(id));
  if (!eligible.length) throw new ProviderRightsPendingError("no-approved-provider");

  let lastError;
  for (const providerId of eligible) {
    try {
      return await operation(providerId);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("No provider returned a response");
}
