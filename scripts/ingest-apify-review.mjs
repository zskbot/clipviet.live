import { mkdir, writeFile } from "node:fs/promises";

const datasetId = process.env.APIFY_DATASET_ID || process.argv[2];
const token = process.env.APIFY_TOKEN;
if (!datasetId) throw new Error("Set APIFY_DATASET_ID or pass a dataset ID.");
if (!token) throw new Error("Missing APIFY_TOKEN secret.");
if (!/^[A-Za-z0-9]{8,64}$/.test(datasetId)) throw new Error("Invalid Apify dataset ID.");

const response = await fetch(`https://api.apify.com/v2/datasets/${encodeURIComponent(datasetId)}/items?format=json&clean=true&limit=50000`, {
  headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  signal: AbortSignal.timeout(30000)
});
if (!response.ok) throw new Error(`Apify dataset fetch failed: HTTP ${response.status}`);
const raw = await response.json();
if (!Array.isArray(raw)) throw new Error("Apify dataset response is not a JSON array.");

const allowedHosts = new Set(["hsex.men", "sexonline.blog", "sexvn.co", "viet69.be", "javhay.onl", "buomtv.biz", "xnhau.plus", "vlxx.net"]);
const tracking = /^(?:utm_.+|fbclid|gclid|ref|source|campaign)$/i;
const normalizeUrl = (value) => {
  try {
    const url = new URL(String(value));
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return null;
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) if (tracking.test(key)) url.searchParams.delete(key);
    url.searchParams.sort();
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\\/+$/, "");
    return url.href;
  } catch { return null; }
};
const getId = (url, item) => {
  const parsed = new URL(url);
  return String(item.videoId || item.id || parsed.searchParams.get("video_key") || parsed.pathname.match(/video-(\\d+)\\.htm/i)?.[1] || parsed.pathname.split("/").filter(Boolean).at(-1) || "");
};
const byKey = new Map();
let invalid = 0, unsupported = 0;
for (const item of raw) {
  if (!item || item.recordType === "crawl_error") { if (item?.recordType === "crawl_error") invalid += 1; continue; }
  const candidate = normalizeUrl(item.canonicalUrl || item.videoUrl || item.url || item.sourceUrl);
  if (!candidate) { invalid += 1; continue; }
  const parsed = new URL(candidate), host = parsed.hostname.toLowerCase();
  if (!allowedHosts.has(host)) { unsupported += 1; continue; }
  const videoId = getId(candidate, item);
  const dedupeKey = host + ":" + videoId.toLowerCase();
  const record = {
    schemaVersion: 1,
    videoId,
    dedupeKey,
    sourceDomain: host,
    title: String(item.title || item.name || videoId).replace(/\\s+/g, " ").trim().slice(0, 240),
    canonicalUrl: candidate,
    videoUrl: candidate,
    discoveredFrom: normalizeUrl(item.discoveredFrom) || null,
    discoveredAt: String(item.discoveredAt || new Date().toISOString()),
    rightsStatus: "PENDING",
    rightsEvidenceUrl: null,
    reviewedBy: null,
    reviewedAt: null
  };
  const existing = byKey.get(dedupeKey);
  if (!existing || (record.title.length > existing.title.length)) byKey.set(dedupeKey, record);
}
const items = [...byKey.values()].sort((a,b)=>a.sourceDomain.localeCompare(b.sourceDomain)||a.title.localeCompare(b.title));
const report = {
  schemaVersion: 1,
  datasetId,
  generatedAt: new Date().toISOString(),
  inputCount: raw.length,
  uniqueCount: items.length,
  invalidCount: invalid,
  unsupportedDomainCount: unsupported,
  deduplicatedCount: Math.max(0, raw.length - invalid - unsupported - items.length),
  policy: "Review-only. No item is approved for distribution. No playback or embed URLs are collected.",
  items
};
await mkdir("artifacts", { recursive: true });
await writeFile("artifacts/apify-crawler-review.json", JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({datasetId,inputCount:report.inputCount,uniqueCount:report.uniqueCount,invalidCount:invalid,unsupportedDomainCount:unsupported,deduplicatedCount:report.deduplicatedCount},null,2));
