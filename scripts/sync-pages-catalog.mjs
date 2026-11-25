import { mkdir, writeFile } from "node:fs/promises";

// Bulk catalog ingestion is disabled unless distribution rights are explicitly verified.
// The homepage reads the read-only Cloudflare Preview API directly; this build step must
// not crawl provider catalogs or copy playback URLs into a static artifact by default.
if (process.env.CATALOG_DISTRIBUTION_AUTHORIZED !== "true") {
  await mkdir("site/data", { recursive: true });
  await writeFile("site/data/catalog.json", JSON.stringify({
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    refreshHours: 6,
    pageSize: 30,
    providers: [],
    categories: [],
    videos: []
  }));
  console.log("Catalog bulk sync skipped: distribution authorization has not been verified.");
  process.exit(0);
}

const providers = [
  { id: "souavzy", name: "Souavzy · Main", baseUrl: "https://api.souavzy.vip/api.php/provide/vod/" },
  { id: "apiyutu", name: "ApiYutu · Backup 1", baseUrl: "https://apiyutu.com/api.php/provide/vod/" },
  { id: "lbapi9", name: "LBApi9 · Backup 2", baseUrl: "https://lbapi9.com/api.php/provide/vod/" },
  { id: "slapibf", name: "Slapibf · Backup 3", baseUrl: "https://slapibf.com/api.php/provide/vod/" },
  { id: "jipinvip1", name: "JipinVIP1 · Backup 4", baseUrl: "https://jipinvip1.com/api.php/provide/vod/" }
];

const maxPages = Math.max(1, Math.min(50, Number(process.env.CATALOG_PAGES_PER_PROVIDER || 20)));
const targetVideoCount = Math.max(1, Math.min(1000, Number(process.env.CATALOG_TARGET_VIDEOS || 1000)));
// Keep declarations on real source lines; escaped newline literals break Node.js parsing.
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const safeUrl = (value) => {
  if (typeof value !== "string" || value.length > 2048) return "";
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" && !url.username && !url.password ? url.toString() : "";
  } catch { return ""; }
};

async function request(provider, params) {
  const url = new URL(provider.baseUrl);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "Mozilla/5.0 (compatible; ClipViet-GitHubPages/1.0)"
        },
        redirect: "error",
        signal: AbortSignal.timeout(15000)
      });
      if (!response.ok) throw new Error("HTTP " + response.status);
      const payload = await response.json();
      if (!payload || typeof payload !== "object" || !Array.isArray(payload.list)) {
        throw new Error("Invalid AppleCMS JSON: list[] missing");
      }
      return payload;
    } catch (error) {
      lastError = error;
      if (attempt === 0) await pause(500);
    }
  }
  throw lastError || new Error("Provider request failed");
}

function parseLines(raw, playFrom) {
  if (typeof raw !== "string" || !raw.trim()) return [];
  const names = typeof playFrom === "string" ? playFrom.split("$$$") : [];
  return raw.split("$$$").flatMap((line, lineIndex) => {
    const episodes = line.split("#").filter(Boolean).flatMap((segment, episodeIndex) => {
      const splitAt = segment.lastIndexOf("$");
      if (splitAt < 0) return [];
      const name = segment.slice(0, splitAt).trim() || "Tập " + (episodeIndex + 1);
      const url = safeUrl(segment.slice(splitAt + 1).trim());
      if (!url) return [];
      return [{ index: episodeIndex, name, url, type: /\.m3u8(?:$|\?)/i.test(url) ? "hls" : /\.mp4(?:$|\?)/i.test(url) ? "mp4" : "unknown" }];
    });
    return episodes.length ? [{
      index: lineIndex,
      name: String(names[lineIndex] || ("Nguồn " + (lineIndex + 1))).slice(0, 80),
      episodes
    }] : [];
  });
}

const excludedAdultLabels = /(?:học\s*sinh|nữ\s*sinh|nam\s*sinh|underage|minor|loli|shota|school\s*(?:girl|boy|student)|teen\s*(?:girl|boy))/i;
const normalizeKey = (value) => String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
function isExcludedAgeLabel(item) { return excludedAdultLabels.test([item.vod_name,item.vod_title,item.vod_class,item.type_name,item.vod_content,item.vod_blurb,item.vod_actor].filter(Boolean).join(" ")); }
function videoFingerprint(video) { return [normalizeKey(video.title),normalizeKey(video.year),normalizeKey(video.area),normalizeKey(video.duration)].join("|"); }

function normalize(item, provider) {
  if (!item || typeof item !== "object") return null;
  const sourceItemId = String(item.vod_id ?? "").trim();
  const title = String(item.vod_name || item.vod_title || "").trim();
  if (!sourceItemId || !title || isExcludedAgeLabel(item)) return null;
  const lines = parseLines(item.vod_play_url, item.vod_play_from);
  return {
    uid: provider.id + ":" + sourceItemId,
    id: sourceItemId,
    sourceId: provider.id,
    sourceName: provider.name,
    title: title.slice(0, 240),
    categoryId: String(item.type_id ?? ""),
    categoryName: String(item.type_name || item.vod_class || "Khác").slice(0, 100),
    parentCategoryId: String(item.type_id_1 ?? ""),
    year: Number.parseInt(String(item.vod_year || ""), 10) || null,
    area: String(item.vod_area || "").slice(0, 80),
    language: String(item.vod_lang || "").slice(0, 80),
    duration: String(item.vod_duration || item.vod_remarks || "").slice(0, 80),
    description: String(item.vod_content || item.vod_blurb || "").slice(0, 3000),
    actors: String(item.vod_actor || "").slice(0, 500),
    director: String(item.vod_director || "").slice(0, 200),
    updatedAt: String(item.vod_time || ""),
    views: Number.parseInt(String(item.vod_hits || "0"), 10) || 0,
    poster: safeUrl(item.vod_pic || item.vod_pic_thumb),
    backdrop: safeUrl(item.vod_pic_slide || item.vod_pic),
    lines,
    hasPlayback: lines.some((line) => line.episodes.length > 0)
  };
}

async function syncProvider(provider) {
  const started = Date.now();
  try {
    const categoryPayload = await request(provider, { ac: "list" });
    const categories = (categoryPayload.class || [])
      .filter((item) => Number(item.type_pid) !== 0)
      .map((item) => ({
        id: String(item.type_id),
        parentId: String(item.type_pid ?? ""),
        name: String(item.type_name || "").slice(0, 100)
      }))
      .filter((item) => item.id && item.name);

    const firstPage = await request(provider, { ac: "detail", pg: 1 });
    const reportedPages = Math.max(1, Number(firstPage.pagecount) || 1);
    const pagesToFetch = Math.min(maxPages, reportedPages);
    const collected = [];
    for (let page = 1; page <= pagesToFetch; page += 1) {
      const payload = page === 1 ? firstPage : await request(provider, { ac: "detail", pg: page });
      for (const item of payload.list) {
        const normalized = normalize(item, provider);
        if (normalized) collected.push(normalized);
      }
      if (page < pagesToFetch) await pause(200);
    }
    const unique = [...new Map(collected.map((item) => [item.uid, item])).values()];
    return {
      provider: { id: provider.id, name: provider.name, state: unique.length ? "online" : "empty", count: unique.length, total: Number(firstPage.total) || 0, pageCount: reportedPages, pagesFetched: pagesToFetch, limit: Number(firstPage.limit) || 0, categoryCount: categories.length, latencyMs: Date.now() - started },
      categories,
      videos: unique,
      error: null
    };
  } catch (error) {
    return {
      provider: { id: provider.id, name: provider.name, state: "offline", count: 0, total: 0, pageCount: 0, pagesFetched: 0, limit: 0, categoryCount: 0, latencyMs: Date.now() - started },
      categories: [],
      videos: [],
      error: String(error?.message || error).slice(0, 240)
    };
  }
}

const results = [];
for (const provider of providers) {
  results.push(await syncProvider(provider));
  await pause(200);
}

const collectedVideos = results.flatMap((result) => result.videos);
const deduplicated = new Map();
for (const video of collectedVideos) {
  const key = videoFingerprint(video);
  const existing = deduplicated.get(key);
  if (!existing || (!existing.hasPlayback && video.hasPlayback) || (!existing.poster && video.poster) || (!existing.description && video.description)) deduplicated.set(key, video);
}
const videos = [...deduplicated.values()].slice(0, targetVideoCount);
const payload = {
  schemaVersion: 1,
  updatedAt: new Date().toISOString(),
  refreshHours: 6,
  pageSize: 20,
  providers: results.map(({ provider, error }) => ({ ...provider, error })),
  categories: results.flatMap((result) => result.categories.map((category) => ({
    ...category,
    sourceId: result.provider.id,
    sourceName: result.provider.name
  }))),
  videos
};

await mkdir("site/data", { recursive: true });
await writeFile("site/data/catalog.json", JSON.stringify(payload));
console.log(JSON.stringify({
  updatedAt: payload.updatedAt,
  providers: payload.providers,
  targetVideos: targetVideoCount,
  targetReached: videos.length >= targetVideoCount,
  totalVideos: videos.length,
  playableVideos: videos.filter((video) => video.hasPlayback).length
}, null, 2));

if (!videos.length) {
  throw new Error("All AppleCMS providers returned no video records; refusing to publish an empty catalogue.");
}

// Preview deployment trigger after enabling this branch.
