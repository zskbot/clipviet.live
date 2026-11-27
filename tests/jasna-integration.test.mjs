import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile("site/jasna/index.html", "utf8");

test("Jasna integration links both the user's fork and upstream project", () => {
  assert.match(page, /https:\/\/github\.com\/zskbot\/jasna/);
  assert.match(page, /https:\/\/github\.com\/Kruk2\/jasna/);
  assert.match(page, /https:\/\/github\.com\/Kruk2\/jasna\/releases/);
});

test("Jasna is documented as a local desktop GPU workflow, not a browser player", () => {
  assert.match(page, /phát hiện vùng mosaic/);
  assert.match(page, /Windows và Linux/);
  assert.match(page, /Không chạy engine Jasna trực tiếp trên iPhone/);
  assert.match(page, /ClipViet không nhận tệp video/);
  assert.match(page, /không chạy job GPU trên server/);
});

test("Jasna integration preserves licensing and user media rights", () => {
  assert.match(page, /AGPL-3\.0/);
  assert.match(page, /model và dependency có thể có điều khoản riêng/);
  assert.match(page, /được cấp quyền tải xuống, chỉnh sửa và xử lý/);
  assert.doesNotMatch(page, /license code.*<input/i);
});
