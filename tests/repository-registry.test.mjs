import test from "node:test";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const registryUrl = new URL("../site/providers.json", import.meta.url);
const providers = JSON.parse(await readFile(registryUrl, "utf8"));
const expectedOriginal = [
  "KaigeCai/live",
  "YYYIKES/porn-description-generator",
  "HertzAdvisor78/Uncensored-ai",
  "JustalK/PORNHUB-API",
  "rlleshi/phar",
  "LucasLeandro1204/pornsearch"
];

test("integration registry retains the six original reviewed repositories", () => {
  const names = new Set(providers.map((item) => item.name));
  for (const name of expectedOriginal) assert.ok(names.has(name), `missing registry entry: ${name}`);
  assert.ok(providers.length >= expectedOriginal.length);
});

test("registry entries have unique IDs and safe HTTPS links", () => {
  const ids = providers.map((item) => item.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const item of providers) {
    assert.ok(item.id && item.name && item.kind && item.status && item.role && item.readiness);
    const url = new URL(item.url);
    assert.equal(url.protocol, "https:");
    assert.ok(url.hostname && !url.username && !url.password);
  }
});

test("external repositories are catalogued but not enabled as media feeds", () => {
  for (const item of providers) {
    assert.ok(!Object.hasOwn(item, "streamUrl"));
    assert.ok(!Object.hasOwn(item, "apiKey"));
  }
});
