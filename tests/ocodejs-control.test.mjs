import test from "node:test";
import assert from "node:assert/strict";
import { getOcodejsOverview, OCODEJS_READ_ONLY_ENDPOINTS } from "../lib/ocodejs-control.mjs";

test("OCodeJS monitoring exposes only the fixed read-only endpoint set", () => {
  assert.deepEqual(OCODEJS_READ_ONLY_ENDPOINTS, [
    "/health/live", "/health/ready", "/services", "/agents", "/providers", "/runtime/status", "/mcp/connections",
  ]);
});

test("OCodeJS monitoring reports missing server credential without making requests", async () => {
  const previous = process.env.OCODEJS_API_TOKEN;
  delete process.env.OCODEJS_API_TOKEN;
  const result = await getOcodejsOverview();
  assert.equal(result.configured, false);
  assert.equal(result.checks.length, 7);
  if (previous !== undefined) process.env.OCODEJS_API_TOKEN = previous;
});

test("OCodeJS monitoring uses GET, does not follow redirects, and redacts secret fields", async () => {
  const previousBase = process.env.OCODEJS_API_BASE_URL;
  const previousToken = process.env.OCODEJS_API_TOKEN;
  process.env.OCODEJS_API_BASE_URL = "https://ocodejs.id.vn";
  process.env.OCODEJS_API_TOKEN = "test-secret";
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    return new Response(JSON.stringify({ status: "ready", api_token: "must-not-leak", nested: { password: "hidden", count: 2 } }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  };
  try {
    const result = await getOcodejsOverview();
    assert.equal(result.configured, true);
    assert.equal(calls.length, 7);
    assert.ok(calls.every((call) => call.options.method === "GET"));
    assert.ok(calls.every((call) => call.options.redirect === "error"));
    assert.ok(calls.every((call) => call.options.headers.Authorization === "Bearer test-secret"));
    assert.equal(result.checks[0].data.api_token, "[redacted]");
    assert.equal(result.checks[0].data.nested.password, "[redacted]");
    assert.equal(result.checks[0].data.nested.count, 2);
  } finally {
    globalThis.fetch = originalFetch;
    if (previousBase === undefined) delete process.env.OCODEJS_API_BASE_URL;
    else process.env.OCODEJS_API_BASE_URL = previousBase;
    if (previousToken === undefined) delete process.env.OCODEJS_API_TOKEN;
    else process.env.OCODEJS_API_TOKEN = previousToken;
  }
});
