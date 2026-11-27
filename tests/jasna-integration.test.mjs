import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../site/video/jasna.html", import.meta.url), "utf8");
const ui = readFileSync(new URL("../site/video/jasna.js", import.meta.url), "utf8");
const bridge = readFileSync(new URL("../tools/jasna-bridge/bridge.py", import.meta.url), "utf8");
const player = readFileSync(new URL("../site/watch/source-player.js", import.meta.url), "utf8");

test("Jasna UI is a local GPU bridge and does not claim browser/iPhone execution", () => {
  assert.match(page, /127\.0\.0\.1:8765/);
  assert.match(page, /iPhone Safari/);
  assert.match(page, /rights-confirm/);
  assert.match(page, /consent-confirm/);
});
test("browser sends files only to loopback and does not persist the access token", () => {
  assert.match(ui, /http:\/\/127\.0\.0\.1:8765/);
  assert.match(ui, /X-ClipViet-Token/);
  assert.doesNotMatch(ui, /localStorage|sessionStorage|document\.cookie/);
  assert.doesNotMatch(ui, /https?:\/\/[^"]+\/jobs/);
});
test("local bridge is loopback-only, token-protected, rights-gated and shell-free", () => {
  assert.match(bridge, /HOST = "127\.0\.0\.1"/);
  assert.match(bridge, /hmac\.compare_digest/);
  assert.match(bridge, /X-ClipViet-Rights-Attested/);
  assert.match(bridge, /X-ClipViet-Consent-Attested/);
  assert.match(bridge, /shell=False/);
  assert.match(bridge, /subprocess\.run\(/);
});

test("direct player enforces explicit, current playback rights and HTTPS media URLs", () => {
  assert.match(player, /function isPlaybackAuthorized/);
  assert.match(player, /rightsVerified === true/);
  assert.match(player, /rightsStatus === "APPROVED"/);
  assert.match(player, /expiry > Date\.now\(\)/);
  assert.match(player, /playbackEnabled === true/);
  assert.match(player, /playbackRightsApproved === true/);
  assert.match(player, /parsed\.protocol === "https:"/);
});
