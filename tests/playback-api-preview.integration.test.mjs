import test from "node:test";
import assert from "node:assert/strict";
import playbackWorker from "../worker/playback-api-preview/src/index.js";

const PREVIEW_ORIGIN = "https://a1b2c3d4.clipviet-live-preview.pages.dev";

function makeDb(row, registryRows = []) {
  return {
    prepare() {
      return {
        bind() { return { first: async () => row }; },
        all: async () => ({ results: registryRows })
      };
    }
  };
}

function approvedRightsRow(overrides = {}) {
  return {
    provider_status: "ENABLED",
    provider_rights_holder: "Test rights holder",
    provider_license_reference: "TEST-PROVIDER-LICENSE",
    provider_rights_evidence_url: "https://rights.example/provider",
    provider_license_expires_at: "2099-01-01T00:00:00.000Z",
    media_hosts_json: '["cdn.example.com"]',
    connector_status: "APPROVED",
    playback_mode: "owner_hosted_stream",
    connector_regions_json: '["VN"]',
    content_status: "APPROVED",
    content_rights_holder: "Test rights holder",
    content_license_reference: "TEST-CONTENT-LICENSE",
    content_source_url: "https://source.example/video/123",
    content_evidence_url: "https://rights.example/video/123",
    content_license_expires_at: "2099-01-01T00:00:00.000Z",
    permitted_uses_json: '["owner_hosted_stream"]',
    content_regions_json: '["VN"]',
    source_verified: 1,
    ownership_verified: 1,
    performer_age_verified: 1,
    performer_consent_verified: 1,
    ...overrides
  };
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" }
  });
}

test("Worker health and provider routes identify the Preview service", async () => {
  const health = await playbackWorker.fetch(
    new Request("https://worker.example/health"),
    { PROVIDER_DB: makeDb(null) }
  );
  assert.equal(health.status, 200);
  const healthBody = await health.json();
  assert.equal(healthBody.service, "clipviet-playback-api-preview");
  assert.equal(healthBody.environment, "preview");
  assert.equal(healthBody.providerRegistryConfigured, true);
  assert.equal(healthBody.playbackPolicy, "deny-by-default");

  const providers = await playbackWorker.fetch(
    new Request("https://worker.example/api/providers"),
    { PROVIDER_DB: makeDb(null) }
  );
  const providersBody = await providers.json();
  assert.equal(providers.status, 200);
  assert.equal(providersBody.count, 5);
});

test("diagnostics report reachability metadata but never expose playback URLs", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => jsonResponse({
    code: 1,
    list: [{ vod_id: 123, vod_play_url: "Episode$https://cdn.example.com/private.m3u8" }]
  });
  try {
    const response = await playbackWorker.fetch(
      new Request("https://worker.example/api/providers/diagnostics", {
        headers: { Origin: PREVIEW_ORIGIN }
      }),
      { PROVIDER_DB: makeDb(null) }
    );
    const body = await response.json();
    const serialized = JSON.stringify(body);
    assert.equal(response.status, 200);
    assert.equal(body.count, 5);
    assert.equal(body.data.every(item => item.reachable === true), true);
    assert.equal(body.data.every(item => item.playbackEnabled === false), true);
    assert.equal(serialized.includes("private.m3u8"), false);
    assert.equal(serialized.includes("vod_play_url"), false);
    assert.equal(response.headers.get("access-control-allow-origin"), PREVIEW_ORIGIN);
  } finally {
    globalThis.fetch = originalFetch;
  }
});


test("provider listing keeps legal rights status separate from operational health", async () => {
  const db = makeDb(null, [{
    id: "souavzy",
    provider_status: "PENDING",
    provider_rights_holder: "",
    provider_license_reference: "",
    provider_rights_evidence_url: "",
    provider_license_expires_at: "",
    media_hosts_json: "[]",
    connector_status: null,
    playback_mode: null
  }]);
  const response = await playbackWorker.fetch(
    new Request("https://worker.example/api/providers"),
    { PROVIDER_DB: db }
  );
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.count, 5);
  const souavzy = body.data.find(item => item.id === "souavzy");
  assert.equal(souavzy.status, "PENDING_RIGHTS");
  assert.equal(souavzy.operationalState, "NOT_CHECKED");
  assert.equal(souavzy.playbackEnabled, undefined);
});

test("diagnostics distinguish active metadata API from pending playback rights", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => jsonResponse({ code: 1, list: [] });
  try {
    const db = makeDb(null, [{
      id: "souavzy", provider_status: "PENDING",
      provider_rights_holder: "", provider_license_reference: "",
      provider_rights_evidence_url: "", provider_license_expires_at: "",
      media_hosts_json: "[]", connector_status: null, playback_mode: null
    }]);
    const response = await playbackWorker.fetch(
      new Request("https://worker.example/api/providers/souavzy/diagnostics", {
        headers: { Origin: PREVIEW_ORIGIN }
      }), { PROVIDER_DB: db }
    );
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.data.status, "PENDING_RIGHTS");
    assert.equal(body.data.operationalState, "ACTIVE");
    assert.equal(body.data.playbackEnabled, false);
  } finally { globalThis.fetch = originalFetch; }
});

test("provider diagnostics reject HTML responses instead of treating them as active APIs", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("<html>blocked</html>", {
    status: 200, headers: { "content-type": "text/html; charset=utf-8" }
  });
  try {
    const response = await playbackWorker.fetch(
      new Request("https://worker.example/api/providers/souavzy/diagnostics", {
        headers: { Origin: PREVIEW_ORIGIN }
      }), { PROVIDER_DB: makeDb(null) }
    );
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.data.operationalState, "ERROR");
    assert.equal(body.data.reason, "provider_diagnostics_invalid_content_type");
  } finally { globalThis.fetch = originalFetch; }
});

test("provider diagnostics cap upstream JSON bodies at one MiB", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(new Uint8Array(1024 * 1024 + 1), {
    status: 200, headers: { "content-type": "application/json" }
  });
  try {
    const response = await playbackWorker.fetch(
      new Request("https://worker.example/api/providers/souavzy/diagnostics", {
        headers: { Origin: PREVIEW_ORIGIN }
      }), { PROVIDER_DB: makeDb(null) }
    );
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.data.operationalState, "ERROR");
    assert.equal(body.data.reason, "provider_diagnostics_response_too_large");
  } finally { globalThis.fetch = originalFetch; }
});

test("pending provider rights deny playback before any upstream detail request", async () => {
  const originalFetch = globalThis.fetch;
  let upstreamCalled = false;
  globalThis.fetch = async () => {
    upstreamCalled = true;
    throw new Error("upstream must not be called when rights are pending");
  };
  try {
    const response = await playbackWorker.fetch(
      new Request("https://worker.example/api/playback/providers/souavzy/videos/123", {
        headers: { Origin: PREVIEW_ORIGIN }
      }),
      { PROVIDER_DB: makeDb(approvedRightsRow({ provider_status: "PENDING" })) }
    );
    const body = await response.json();
    assert.equal(response.status, 403);
    assert.equal(body.code, "provider_not_approved");
    assert.equal(body.playbackEnabled, false);
    assert.equal(upstreamCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("approved playback returns only HTTPS media URLs on the licensed host allowlist", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => jsonResponse({
    code: 1,
    list: [{
      vod_id: 123,
      vod_name: "Licensed test title",
      vod_pic: "https://img.example/poster.jpg",
      vod_play_from: "CDN",
      vod_play_url: "Episode 1$https://cdn.example.com/one.m3u8#Unapproved$https://evil.example/two.m3u8"
    }]
  });
  try {
    const response = await playbackWorker.fetch(
      new Request("https://worker.example/api/playback/providers/souavzy/videos/123", {
        headers: { Origin: PREVIEW_ORIGIN }
      }),
      { PROVIDER_DB: makeDb(approvedRightsRow()) }
    );
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.data.playbackEnabled, true);
    assert.equal(body.data.playbackRightsApproved, true);
    assert.equal(body.data.lines.length, 1);
    assert.equal(body.data.lines[0].episodes.length, 1);
    assert.equal(body.data.lines[0].episodes[0].url, "https://cdn.example.com/one.m3u8");
    assert.equal(response.headers.get("access-control-allow-origin"), PREVIEW_ORIGIN);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Worker rejects unapproved origins and unsupported methods", async () => {
  const blocked = await playbackWorker.fetch(
    new Request("https://worker.example/health", {
      headers: { Origin: "https://attacker.example" }
    }),
    {}
  );
  assert.equal(blocked.status, 403);

  const method = await playbackWorker.fetch(
    new Request("https://worker.example/health", { method: "POST" }),
    {}
  );
  assert.equal(method.status, 405);
});
