import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const registryUrl = new URL("../site/providers.json", import.meta.url);
const providers = JSON.parse(await readFile(registryUrl, "utf8"));
const expected = [
  "KaigeCai/live",
  "YYYIKES/porn-description-generator",
  "HertzAdvisor78/Uncensored-ai",
  "JustalK/PORNHUB-API",
  "rlleshi/phar",
  "LucasLeandro1204/pornsearch"
];

test("integration registry includes all six reviewed repositories", () => {
  assert.equal(providers.length, expected.length);
  assert.deepEqual(providers.map((item) => item.name), expected);
});

test("registry entries have unique IDs and safe GitHub links", () => {
  const ids = providers.map((item) => item.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const item of providers) {
    assert.ok(item.id && item.name && item.kind && item.status && item.role && item.readiness);
    const url = new URL(item.url);
    assert.equal(url.protocol, "https:");
    assert.equal(url.hostname, "github.com");
  }
});

test("external repositories are catalogued but not enabled as media feeds", () => {
  for (const item of providers) {
    assert.ok(!Object.hasOwn(item, "streamUrl"));
    assert.ok(!Object.hasOwn(item, "apiKey"));
  }
});
