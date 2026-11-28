import test from "node:test";
import assert from "node:assert/strict";
import { buildSourceIntake, normalizeSourceUrl, classifySourceUrl } from "../scripts/normalize-source-intake.mjs";

test("normalizes host, removes tracking parameters, preserves functional query", () => {
  assert.equal(
    normalizeSourceUrl("https://EXAMPLE.com/list?utm_source=chatgpt&sort=hot#top"),
    "https://example.com/list?sort=hot",
  );
});

test("rejects non-HTTPS URLs and embedded credentials", () => {
  assert.throws(() => normalizeSourceUrl("http://example.com"), /HTTPS/);
  assert.throws(() => normalizeSourceUrl("https://user:pass@example.com"), /credentials/);
});

test("rejects secret-like query parameters", () => {
  assert.throws(() => normalizeSourceUrl("https://example.com/api?token=abc"), /secret-like/);
});

test("classifies AppleCMS endpoint candidates without contacting them", () => {
  assert.equal(classifySourceUrl("https://api.example.com/api.php/provide/vod/"), "APPLECMS_API_CANDIDATE");
  assert.equal(classifySourceUrl("https://example.com/videos"), "WEBSITE_CANDIDATE");
});

test("deduplicates canonical URLs and keeps sort parameter variants distinct", () => {
  const result = buildSourceIntake([
    "https://EXAMPLE.com/list?utm_source=x",
    "https://example.com/list",
    "https://example.com/list?sort=hot",
  ].join("\n"), "2026-11-28T00:00:00.000Z");
  assert.equal(result.source_count, 2);
  assert.equal(result.duplicate_count, 1);
  assert.equal(result.sources[0].rights_status, "PENDING");
  assert.equal(result.sources[0].playback_enabled, false);
  assert.equal(result.approved_count, 0);
  assert.equal(result.published_count, 0);
});

test("quarantines malformed or unsafe URLs without fetching them", () => {
  const result = buildSourceIntake("javascript:alert(1)\nhttps://example.com/?api_key=secret");
  assert.equal(result.source_count, 0);
  assert.equal(result.rejected_count, 2);
  assert.equal(result.sources.length, 0);
});
