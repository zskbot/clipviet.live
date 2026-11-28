import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";

const DEFAULT_BATCH_SIZE = 1000;
const MAX_BATCH_SIZE = 5000;
const MAX_RECORDS = 130921;

export function parseCsv(source) {
  const rows = [];
  let row = [], field = "", quoted = false;
  const input = String(source).replace(/^\uFEFF/, "");
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') { field += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"' && field.length === 0) quoted = true;
    else if (char === ",") { row.push(field); field = ""; }
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && input[i + 1] === "\n") i += 1;
      row.push(field); field = "";
      if (row.some(value => value.trim() !== "")) rows.push(row);
      row = [];
    } else field += char;
  }
  if (quoted) throw new Error("CSV contains an unterminated quoted field.");
  if (field.length || row.length) { row.push(field); rows.push(row); }
  if (!rows.length) return [];
  const headers = rows.shift().map(value => value.trim());
  if (new Set(headers).size !== headers.length) throw new Error("CSV contains duplicate column names.");
  return rows.map(values => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}

const clean = (value, max = 500) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const httpsUrl = value => {
  try {
    const url = new URL(String(value || "").trim());
    return url.protocol === "https:" && !url.username && !url.password ? url : null;
  } catch { return null; }
};

export function normalizeRecord(input, options = {}) {
  const row = input && typeof input === "object" ? input : {};
  const errors = [];
  const title = clean(row.title, 240);
  if (!title) errors.push("TITLE_REQUIRED");
  const rightsHolder = clean(row.rights_holder || row.rightsHolder, 240);
  const licenseReference = clean(row.license_reference || row.licenseReference, 240);
  const evidence = httpsUrl(row.rights_evidence_url || row.rightsEvidenceUrl);
  const expiryRaw = clean(row.license_expires_at || row.licenseExpiresAt, 80);
  const expiry = Date.parse(expiryRaw);
  const now = options.now ? new Date(options.now).getTime() : Date.now();
  if (!rightsHolder) errors.push("RIGHTS_HOLDER_REQUIRED");
  if (!licenseReference) errors.push("LICENSE_REFERENCE_REQUIRED");
  if (!evidence) errors.push("HTTPS_RIGHTS_EVIDENCE_REQUIRED");
  if (!Number.isFinite(expiry) || expiry <= now) errors.push("LICENSE_EXPIRY_INVALID_OR_EXPIRED");

  const media = httpsUrl(row.media_url || row.mediaUrl);
  if (!media) errors.push("HTTPS_MEDIA_URL_REQUIRED");
  const allowedHosts = new Set((options.allowedHosts || []).map(host => String(host).trim().toLowerCase()).filter(Boolean));
  if (media && (!allowedHosts.size || ![...allowedHosts].some(host => media.hostname.toLowerCase() === host || media.hostname.toLowerCase().endsWith("." + host)))) {
    errors.push("MEDIA_HOST_NOT_ALLOWLISTED");
  }
  const source = httpsUrl(row.source_url || row.sourceUrl);
  if ((row.source_url || row.sourceUrl) && !source) errors.push("SOURCE_URL_MUST_BE_HTTPS");

  const id = clean(row.id || row.uid, 160) || randomUUID();
  const eligibleForReview = errors.length === 0;
  return {
    id,
    title,
    description: clean(row.description, 3000),
    category: clean(row.category, 120),
    thumbnailUrl: httpsUrl(row.thumbnail_url || row.thumbnailUrl)?.href || null,
    mediaUrl: eligibleForReview ? media.href : null,
    sourceUrl: source?.href || null,
    rights: {
      status: "PENDING_REVIEW",
      rightsHolder: rightsHolder || null,
      licenseReference: licenseReference || null,
      evidenceUrl: evidence?.href || null,
      expiresAt: Number.isFinite(expiry) ? new Date(expiry).toISOString() : null,
      allowedRegions: clean(row.allowed_regions || row.allowedRegions, 240) || null,
      playbackRequested: /^(1|true|yes)$/i.test(String(row.playback_allowed ?? row.playbackAllowed ?? ""))
    },
    importStatus: eligibleForReview ? "READY_FOR_MANUAL_REVIEW" : "QUARANTINED",
    quarantineReasons: errors
  };
}

export function buildImportPlan(rows, options = {}) {
  const batchSize = Math.max(1, Math.min(MAX_BATCH_SIZE, Number(options.batchSize) || DEFAULT_BATCH_SIZE));
  const maxRecords = Math.min(MAX_RECORDS, Number(options.maxRecords) || MAX_RECORDS);
  const selected = rows.slice(0, maxRecords);
  const seen = new Set();
  const records = [];
  let duplicateCount = 0;
  for (const row of selected) {
    const record = normalizeRecord(row, options);
    const key = record.id.toLowerCase();
    if (seen.has(key)) { duplicateCount += 1; continue; }
    seen.add(key);
    records.push(record);
  }
  const readyCount = records.filter(record => record.importStatus === "READY_FOR_MANUAL_REVIEW").length;
  const quarantinedCount = records.length - readyCount;
  return {
    schemaVersion: 1,
    mode: "LOCAL_REVIEW_ARTIFACT_ONLY",
    generatedAt: new Date(options.now || Date.now()).toISOString(),
    inputCount: rows.length,
    processedCount: selected.length,
    truncatedCount: Math.max(0, rows.length - selected.length),
    uniqueCount: records.length,
    duplicateCount,
    readyForManualReview: readyCount,
    quarantined: quarantinedCount,
    published: 0,
    playbackEnabled: 0,
    rightsApproved: 0,
    batchSize,
    batches: Array.from({ length: Math.ceil(records.length / batchSize) }, (_, index) => ({
      index: index + 1,
      records: records.slice(index * batchSize, (index + 1) * batchSize)
    }))
  };
}

async function loadInput(file) {
  const source = await readFile(file, "utf8");
  if (file.toLowerCase().endsWith(".csv")) return parseCsv(source);
  const parsed = JSON.parse(source);
  if (Array.isArray(parsed)) return parsed;
  if (parsed && Array.isArray(parsed.items)) return parsed.items;
  throw new Error("Input must be a JSON array, { items: [] }, or CSV file.");
}

async function main() {
  const input = process.argv[2];
  if (!input) throw new Error("Usage: node scripts/import-licensed-catalog.mjs <input.csv|input.json> [output-dir]");
  const outputDir = path.resolve(process.argv[3] || "artifacts/clipviet-import-review");
  const rows = await loadInput(input);
  const allowedHosts = String(process.env.CLIPVIET_MEDIA_HOST_ALLOWLIST || "").split(",").map(value => value.trim()).filter(Boolean);
  const plan = buildImportPlan(rows, { allowedHosts, batchSize: process.env.CLIPVIET_IMPORT_BATCH_SIZE });
  await mkdir(outputDir, { recursive: true });
  for (const batch of plan.batches) {
    const name = "batch-" + String(batch.index).padStart(4, "0") + ".json";
    await writeFile(path.join(outputDir, name), JSON.stringify({ schemaVersion: 1, batch: batch.index, records: batch.records }, null, 2) + "\n");
  }
  const report = { ...plan, batches: plan.batches.map(batch => ({ index: batch.index, count: batch.records.length })) };
  await writeFile(path.join(outputDir, "report.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
  console.log("No database writes, publication, rights approval, or playback enablement were performed.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
