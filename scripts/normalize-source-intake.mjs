#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const SECRET_QUERY_KEY = /^(?:api[_-]?key|access[_-]?token|token|auth|authorization|signature|sig|password|passwd|key)$/i;

export function normalizeSourceUrl(raw) {
  const value = String(raw ?? "").trim();
  if (!value) return null;

  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Invalid URL");
  }

  if (url.protocol !== "https:") throw new Error("Only HTTPS source URLs are accepted");
  if (url.username || url.password) throw new Error("URLs containing credentials are not accepted");
  url.hash = "";

  for (const key of url.searchParams.keys()) {
    if (SECRET_QUERY_KEY.test(key)) throw new Error("URL contains a secret-like query parameter");
  }

  for (const key of [...url.searchParams.keys()]) {
    if (/^(utm_.+|fbclid|gclid)$/i.test(key)) url.searchParams.delete(key);
  }

  url.hostname = url.hostname.toLowerCase();
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
  url.searchParams.sort();
  return url.toString();
}

export function classifySourceUrl(value) {
  const url = new URL(value);
  if (/\/api\.php\/provide\/vod\/?$/i.test(url.pathname)) return "APPLECMS_API_CANDIDATE";
  return "WEBSITE_CANDIDATE";
}

export function buildSourceIntake(inputText, submittedAt = new Date().toISOString()) {
  const lines = String(inputText).split(/\r?\n/);
  const seen = new Set();
  const sources = [];
  const rejected = [];
  let duplicateCount = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index].trim();
    if (!raw) continue;
    try {
      const normalizedUrl = normalizeSourceUrl(raw);
      if (!normalizedUrl) continue;
      if (seen.has(normalizedUrl)) {
        duplicateCount += 1;
        continue;
      }
      seen.add(normalizedUrl);
      const id = createHash("sha256").update(normalizedUrl).digest("hex").slice(0, 16);
      sources.push({
        id,
        source_url: normalizedUrl,
        hostname: new URL(normalizedUrl).hostname,
        source_type: classifySourceUrl(normalizedUrl),
        intake_status: "PENDING_REVIEW",
        rights_status: "PENDING",
        rights_evidence_url: null,
        api_docs_url: null,
        auth_mode: "UNKNOWN",
        playback_enabled: false,
        published: false,
        verification: "NOT_CHECKED",
        submitted_at: submittedAt,
      });
    } catch (error) {
      rejected.push({ line: index + 1, reason: error.message });
    }
  }

  return {
    schema_version: 1,
    generated_at: submittedAt,
    source_count: sources.length,
    duplicate_count: duplicateCount,
    rejected_count: rejected.length,
    approved_count: 0,
    published_count: 0,
    playback_enabled_count: 0,
    sources,
    rejected,
  };
}

async function main() {
  const [inputPath, outputPath = "artifacts/source-intake/candidates.json"] = process.argv.slice(2);
  if (!inputPath) {
    console.error("Usage: node scripts/normalize-source-intake.mjs <urls.txt> [output.json]");
    process.exitCode = 2;
    return;
  }

  const result = buildSourceIntake(await readFile(resolve(inputPath), "utf8"));
  const target = resolve(outputPath);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, JSON.stringify(result, null, 2) + "\n", { mode: 0o600 });
  console.log(JSON.stringify({
    output: target,
    source_count: result.source_count,
    duplicate_count: result.duplicate_count,
    rejected_count: result.rejected_count,
    approved_count: result.approved_count,
    published_count: result.published_count,
    playback_enabled_count: result.playback_enabled_count,
  }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
