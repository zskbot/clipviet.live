import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../functions/api/videos.js", import.meta.url), "utf8");

test("unified video gateway has one canonical read-only contract", () => {
  assert.match(source, /endpoint: "\/api\/videos"/);
  assert.match(source, /request\.method !== "GET" && request\.method !== "HEAD"/);
  assert.match(source, /Method not allowed/);
});

test("all five source adapters remain disabled pending rights review", () => {
  for (const id of ["souavzy", "apiyutu", "lbapi9", "slapibf", "jipinvip1"]) {
    assert.match(source, new RegExp('"id": "' + id + '"'));
  }
  assert.match(source, /status: "PENDING"/);
  assert.match(source, /enabled: false/);
  assert.match(source, /rightsApproved: false/);
  assert.match(source, /externalFetchingEnabled: false/);
  assert.doesNotMatch(source, /fetch\s*\(/);
});

test("gateway never returns third-party media in pending mode", () => {
  assert.match(source, /results: \[\]/);
  assert.match(source, /items: \[\]/);
  assert.match(source, /publicPlaybackEnabled: false/);
});
