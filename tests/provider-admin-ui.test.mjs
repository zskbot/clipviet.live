import test from "node:test";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { adminPage } from "../workers/provider-registry/src/admin-ui.mjs";

test("Preview admin console is mobile-first, same-origin and does not depend on external assets", async () => {
  const response = adminPage();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /text\/html/);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.match(response.headers.get("content-security-policy"), /connect-src 'self'/);
  const html = await response.text();
  assert.match(html, /name="viewport"/);
  assert.match(html, /RUN DIAGNOSTIC/);
  assert.match(html, /\/health/);
  assert.match(html, /\/providers/);
  assert.match(html, /credentials:"same-origin"/);
  assert.match(html, /All seeded providers remain PENDING/);
  assert.doesNotMatch(html, /https?:\/\/[^"' ]+\.(?:js|css)/);
});

test("static admin preview is public read-only and exposes no write controls", async () => {
  const page = await readFile(new URL("../site/admin/index.html", import.meta.url), "utf8");
  assert.match(page, /Admin Preview công khai, không yêu cầu đăng nhập/);
  assert.match(page, /Chỉ đọc dữ liệu D1 Preview/);
  assert.match(page, /Mọi thao tác tạo, sửa, duyệt, xuất bản, upload và xóa đều bị khóa tại API/);
  assert.match(page, /PREVIEW ONLY · READ-ONLY/);
  assert.doesNotMatch(page, /id="admin-login-gate"|name="pin"|\/api\/admin\/login/);
  assert.match(page, /fetch\(url,\{cache:"no-store",credentials:"same-origin"\}\)/);
  assert.doesNotMatch(page, /method\s*:\s*["'](?:POST|PUT|PATCH|DELETE)["']/i);
  assert.doesNotMatch(page, /<form\b|<button\b/i);
});
