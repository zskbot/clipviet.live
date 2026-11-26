import { readFile, writeFile } from "node:fs/promises";

const approvalPath = "data/apify-rights-approved.json";
const catalogPath = "site/data/catalog.json";
const approvals = JSON.parse(await readFile(approvalPath, "utf8"));
const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
if (!Array.isArray(approvals.items)) throw new Error("rights approval registry must contain items[]");
const approved = [];
const seen = new Set();
for (const item of approvals.items) {
  if (item.rightsStatus !== "APPROVED") continue;
  if (!item.rightsEvidenceUrl || !item.reviewedBy || !item.reviewedAt) throw new Error("Approved item missing evidence URL, reviewer, or review timestamp.");
  const evidence = new URL(item.rightsEvidenceUrl);
  const source = new URL(item.canonicalUrl || item.videoUrl);
  if (evidence.protocol !== "https:" || !["https:", "http:"].includes(source.protocol)) throw new Error("Evidence must use HTTPS and source URL must be HTTP(S).");
  if (!item.videoId || !item.title || !item.sourceDomain) throw new Error("Approved item missing identity metadata.");
  const key = String(item.dedupeKey || (item.sourceDomain + ":" + item.videoId)).toLowerCase();
  if (seen.has(key)) continue;
  seen.add(key);
  approved.push({
    videoId: String(item.videoId),
    title: String(item.title).slice(0,240),
    sourceDomain: String(item.sourceDomain).toLowerCase(),
    sourceUrl: source.href,
    category: String(item.category || "Chưa phân loại"),
    rightsStatus: "APPROVED",
    rightsEvidenceUrl: evidence.href,
    reviewedBy: String(item.reviewedBy),
    reviewedAt: String(item.reviewedAt)
  });
}
catalog.schemaVersion = Math.max(1, Number(catalog.schemaVersion) || 1);
catalog.crawlerVideos = approved;
catalog.crawlerCatalogUpdatedAt = new Date().toISOString();
await writeFile(catalogPath, JSON.stringify(catalog) + "\\n");
console.log(JSON.stringify({approvedCrawlerVideos:approved.length,publicCatalogVideos:catalog.videos?.length || 0},null,2));
