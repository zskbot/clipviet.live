import test from "node:test";
import assert from "node:assert/strict";
import {
  getApiVideoApiBaseUrl,
  getApiVideoIntegrationStatus,
  getApprovedApiVideoEntries,
  getApprovedApiVideoPlayback,
  getApprovedApiVideoSourceHosts,
  validateApiVideoSourceUrl
} from "../lib/apivideo.mjs";

test("API.video playback is deny-by-default", () => {
  assert.deepEqual(getApprovedApiVideoEntries({}), []);
  assert.equal(getApprovedApiVideoPlayback("vi54sj9dAakOHJXKrUycCQZp", {}), null);
});

test("only explicitly approved, well-formed video IDs are exposed", () => {
  const env = {
    APIVIDEO_APPROVED_VIDEO_IDS_JSON: JSON.stringify([
      { id: "vi54sj9dAakOHJXKrUycCQZp", live: false },
      { id: "live_ABC123", live: true },
      { id: "javascript:alert(1)", live: true },
      { id: "vi54sj9dAakOHJXKrUycCQZp", live: true }
    ])
  };
  assert.deepEqual(getApprovedApiVideoEntries(env), [
    { id: "vi54sj9dAakOHJXKrUycCQZp", live: true },
    { id: "live_ABC123", live: true }
  ]);
  assert.deepEqual(getApprovedApiVideoPlayback("live_ABC123", env), { id: "live_ABC123", live: true });
});

test("status exposes booleans and counts, never API key contents", () => {
  const status = getApiVideoIntegrationStatus({
    APIVIDEO_API_KEY: "private-secret-value",
    APIVIDEO_APPROVED_VIDEO_IDS_JSON: JSON.stringify([{ id: "vi54sj9dAakOHJXKrUycCQZp" }])
  });
  assert.equal(status.apiKeyConfigured, true);
  assert.equal(status.approvedPlaybackCount, 1);
  assert.equal(JSON.stringify(status).includes("private-secret-value"), false);
});

test("API source ingestion is restricted to explicitly approved HTTPS hosts", () => {
  const env = { APIVIDEO_APPROVED_SOURCE_HOSTS_JSON: JSON.stringify(["media.example.com", "localhost", "bad host"]) };
  assert.deepEqual(getApprovedApiVideoSourceHosts(env), ["media.example.com"]);
  assert.equal(validateApiVideoSourceUrl("https://media.example.com/owned.mp4", env), "https://media.example.com/owned.mp4");
  assert.equal(validateApiVideoSourceUrl("https://other.example/owned.mp4", env), null);
  assert.equal(validateApiVideoSourceUrl("http://media.example.com/owned.mp4", env), null);
  assert.equal(validateApiVideoSourceUrl("https://localhost/file.mp4", { APIVIDEO_APPROVED_SOURCE_HOSTS_JSON: '["localhost"]' }), null);
});

test("API writes default to sandbox and production uses an explicit environment", () => {
  assert.equal(getApiVideoApiBaseUrl({}), "https://sandbox.api.video");
  assert.equal(getApiVideoApiBaseUrl({ APIVIDEO_ENV: "production" }), "https://ws.api.video");
});

test("invalid allowlist JSON fails closed", () => {
  assert.equal(getApprovedApiVideoPlayback("vi54sj9dAakOHJXKrUycCQZp", {
    APIVIDEO_APPROVED_VIDEO_IDS_JSON: "{"
  }), null);
  assert.equal(getApiVideoIntegrationStatus({
    APIVIDEO_APPROVED_VIDEO_IDS_JSON: "{"
  }).configurationValid, false);
});
