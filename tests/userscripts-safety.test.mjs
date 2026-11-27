import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const script = await readFile(new URL("../site/userscripts/clipviet-player-tools.user.js", import.meta.url), "utf8");
const page = await readFile(new URL("../site/userscripts/index.html", import.meta.url), "utf8");

test("ClipViet Player Tools is valid JavaScript", () => {
  assert.doesNotThrow(() => new Function(script));
});

test("ClipViet Player Tools is opt-in and restricted to ClipViet hosts", () => {
  assert.match(script, /^\/\/ @grant\s+none$/m);
  const matches = script.split("\n").filter(line => /^\/\/ @match\s+/.test(line));
  assert.ok(matches.length >= 4);
  assert.ok(matches.every(line =>
    /https:\/\/(?:www\.)?clipviet\.live\//.test(line) ||
    /https:\/\/\*\.clipviet-live-(?:preview|independent-preview)\.pages\.dev\//.test(line)
  ));
});

test("ClipViet Player Tools does not request remote code, network or cookie access", () => {
  assert.doesNotMatch(script, /@require|@connect|GM_[A-Za-z]|GM\.[A-Za-z]/);
  assert.doesNotMatch(script, /\bfetch\s*\(|XMLHttpRequest|document\.cookie/);
});

test("Safari fullscreen fallback uses the video element receiver", () => {
  assert.match(script, /video\.webkitEnterFullscreen\(\)/);
  assert.doesNotMatch(script, /webkitEnterFullscreen[^\n]*call\(target\)/);
});

test("Browser Tools page links to local and curated upstream scripts only", () => {
  assert.match(page, /CodeSenbot\/UserScripts/);
  assert.match(page, /href="\.\/clipviet-player-tools\.user\.js"/);
  const upstreamLinks = [...page.matchAll(/href="(https:\/\/raw\.githubusercontent\.com\/CodeSenbot\/UserScripts\/main\/[^"]+)"/g)]
    .map(match => match[1]);
  assert.ok(upstreamLinks.length >= 3);
  assert.ok(upstreamLinks.every(url => !/(?:downloader|auto-login|porn|missav|xnxx|xhamster)/i.test(url)));
});
