import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const script = await readFile(new URL("../site/userscripts/clipviet-player-tools.user.js", import.meta.url), "utf8");
const page = await readFile(new URL("../site/userscripts/index.html", import.meta.url), "utf8");

test("ClipViet userscript is opt-in and scoped to ClipViet hosts", () => {
  assert.match(script, /@grant\s+none/);
  assert.match(script, /@match\s+https:\/\/clipviet\.live\/\*/);
  assert.match(script, /@match\s+https:\/\/www\.clipviet\.live\/\*/);
  assert.match(script, /@match\s+https:\/\/\*\.clipviet-live-preview\.pages\.dev\/\*/);
  assert.match(script, /@match\s+https:\/\/\*\.clipviet-live-independent-preview\.pages\.dev\/\*/);
  assert.match(script, /@noframes/);
});

test("ClipViet userscript does not perform network or credential access", () => {
  assert.doesNotMatch(script, /\bfetch\s*\(|XMLHttpRequest|GM_xmlhttpRequest|document\.cookie|localStorage|sessionStorage/);
  assert.doesNotMatch(script, /\beval\s*\(|new Function\s*\(/);
});

test("player shortcut handlers remain opt-in and do not autoplay on page load", () => {
  for (const key of ['"k"', '"arrowleft"', '"arrowright"', '"m"', '"f"', '"p"', '"["', '"]"', '"0"']) {
    assert.ok(script.includes(key), `Missing player shortcut: ${key}`);
  }
  assert.match(script, /video\.play\(\)/);
  assert.doesNotMatch(script, /autoplay\s*=\s*true|\.autoplay\s*=\s*true/);
});

test("Browser Tools page attributes the upstream userscripts repository", () => {
  assert.match(page, /https:\/\/github\.com\/CodeSenbot\/UserScripts/);
  assert.match(page, /không tự tải, tự cài hoặc tự thực thi mã bên thứ ba/i);
});
