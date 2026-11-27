import test from "node:test";
import assert from "node:assert/strict";
import { evaluatePlaybackRights, isAllowedMediaUrl, parsePlaybackLines } from "../worker/playback-api-preview/src/policy.mjs";

function approvedRow(overrides = {}) {
  return {
    provider_status: "ENABLED",
    provider_rights_holder: "Rights Holder",
    provider_license_reference: "PROVIDER-LICENSE-1",
    provider_rights_evidence_url: "https://evidence.example/provider",
    provider_license_expires_at: "2099-01-01T00:00:00.000Z",
    media_hosts_json: "[\"cdn.example.com\"]",
    connector_status: "APPROVED",
    playback_mode: "owner_hosted_stream",
    connector_regions_json: "[\"VN\"]",
    content_status: "APPROVED",
    content_rights_holder: "Rights Holder",
    content_license_reference: "CONTENT-LICENSE-1",
    content_source_url: "https://source.example/video/123",
    content_evidence_url: "https://evidence.example/video/123",
    content_license_expires_at: "2099-01-01T00:00:00.000Z",
    permitted_uses_json: "[\"owner_hosted_stream\"]",
    content_regions_json: "[\"VN\"]",
    source_verified: 1,
    ownership_verified: 1,
    performer_age_verified: 1,
    performer_consent_verified: 1,
    ...overrides
  };
}

test("playback rights deny pending providers", () => {
  assert.equal(evaluatePlaybackRights(approvedRow({ provider_status: "PENDING" })).reason, "provider_not_approved");
});

test("playback rights deny metadata-only connectors", () => {
  assert.equal(evaluatePlaybackRights(approvedRow({ playback_mode: "metadata_only" })).reason, "direct_stream_mode_not_approved");
});

test("playback rights deny missing media-host allowlists", () => {
  assert.equal(evaluatePlaybackRights(approvedRow({ media_hosts_json: "[]" })).reason, "media_host_allowlist_empty");
});

test("playback rights accept a complete unexpired owner-hosted grant", () => {
  const result = evaluatePlaybackRights(approvedRow(), "VN");
  assert.equal(result.allowed, true);
  assert.equal(result.mediaHosts[0], "cdn.example.com");
});

test("media URL must be HTTPS and match an exact or explicit wildcard host", () => {
  assert.equal(isAllowedMediaUrl("https://cdn.example.com/a.m3u8", ["cdn.example.com"]), true);
  assert.equal(isAllowedMediaUrl("https://sub.cdn.example.com/a.m3u8", ["*.cdn.example.com"]), true);
  assert.equal(isAllowedMediaUrl("https://evil.example/a.m3u8", ["cdn.example.com"]), false);
  assert.equal(isAllowedMediaUrl("http://cdn.example.com/a.m3u8", ["cdn.example.com"]), false);
});

test("AppleCMS playback parser drops media URLs outside the approved host set", () => {
  const lines = parsePlaybackLines("Episode 1$https://cdn.example.com/one.m3u8#Episode 2$https://evil.example/two.m3u8", "CDN", ["cdn.example.com"]);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].episodes.length, 1);
  assert.equal(lines[0].episodes[0].type, "hls");
});
