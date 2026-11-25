import test from "node:test";
import assert from "node:assert/strict";
import { isAllowedApiUrl, isAllowedEmbedUrl, isAllowedMediaUrl, getVideoSecurityConfig } from "../lib/embed-security.mjs";

test("allows only official HTTPS player hosts and valid player paths", () => {
  assert.equal(isAllowedEmbedUrl("https://www.youtube-nocookie.com/embed/abcDEF_123"), true);
  assert.equal(isAllowedEmbedUrl("https://player.vimeo.com/video/12345"), true);
  assert.equal(isAllowedEmbedUrl("https://www.dailymotion.com/embed/video/x123"), true);
  assert.equal(isAllowedEmbedUrl("https://t.me/channel/123?embed=1"), false);
  assert.equal(isAllowedEmbedUrl("https://evil.example/embed/123"), false);
  assert.equal(isAllowedEmbedUrl("https://player.vimeo.com.evil.example/video/123"), false);
  assert.equal(isAllowedEmbedUrl("javascript:alert(1)"), false);
  assert.equal(isAllowedEmbedUrl("https://user:pass@player.vimeo.com/video/123"), false);
});

test("custom embed hosts require exact explicit allowlisting", () => {
  assert.equal(isAllowedEmbedUrl("https://media.example/embed/abc", "media.example"), true);
  assert.equal(isAllowedEmbedUrl("https://sub.media.example/embed/abc", "media.example"), false);
  assert.equal(isAllowedEmbedUrl("https://media.example.evil.test/embed/abc", "media.example"), false);
});

test("direct media hosts are denied unless explicitly allowlisted", () => {
  assert.equal(isAllowedMediaUrl("https://cdn.example/video.mp4"), false);
  assert.equal(isAllowedMediaUrl("https://cdn.example/video.mp4", "cdn.example"), true);
  assert.equal(isAllowedMediaUrl("http://cdn.example/video.mp4", "cdn.example"), false);
  assert.equal(isAllowedMediaUrl("https://127.0.0.1/video.mp4", "127.0.0.1"), false);
  assert.equal(isAllowedMediaUrl("https://[::1]/video.mp4", "[::1]"), false);
  assert.equal(isAllowedMediaUrl("https://cdn.example:8443/video.mp4", "cdn.example"), false);
});

test("provider API hosts require exact explicit allowlisting", () => {
  assert.equal(isAllowedApiUrl("https://api.example/videos"), false);
  assert.equal(isAllowedApiUrl("https://api.example/videos", "api.example"), true);
  assert.equal(isAllowedApiUrl("https://api.example.evil.test/videos", "api.example"), false);
  assert.equal(isAllowedApiUrl("https://api.example/videos", "sub.api.example"), false);
});

test("allowlist config exposes hostnames only and keeps empty media defaults", () => {
  const config = getVideoSecurityConfig({
    VIDEO_EMBED_ALLOWED_HOSTS: "embed.example,player.vimeo.com",
    VIDEO_MEDIA_ALLOWED_HOSTS: "cdn.example",
    VIDEO_API_ALLOWED_HOSTS: "api.example"
  });
  assert.deepEqual(config.mediaHosts, ["cdn.example"]);
  assert.deepEqual(config.apiHosts, ["api.example"]);
  assert.ok(config.embedHosts.includes("embed.example"));
  assert.equal(JSON.stringify(config).includes("SECRET"), false);
});
