import test from "node:test";
import assert from "node:assert/strict";
import { onRequest } from "../functions/api/videos.js";

const request = (method, path = "/api/videos") => new Request("https://preview.example.test" + path, { method });

test("GET keeps results/items aliases and normalizes legacy frontend query parameters", async () => {
  const response = await onRequest({ request: request("GET", "/api/videos?keyword=demo&categoryId=sci-fi&currentPage=2&pageSize=12") });
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(payload.results, []);
  assert.deepEqual(payload.items, []);
  assert.equal(payload.page, 2);
  assert.equal(payload.limit, 12);
  assert.deepEqual(payload.filters, { query: "demo", categoryId: "sci-fi" });
  assert.equal(payload.rightsGate.policy, "deny-by-default");
});

test("HEAD returns the GET status and headers without a response body", async () => {
  const response = await onRequest({ request: request("HEAD", "/api/videos?page=1&limit=30") });
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "");
});

test("OPTIONS advertises only safe read methods", async () => {
  const response = await onRequest({ request: request("OPTIONS") });
  assert.equal(response.status, 204);
  assert.equal(response.headers.get("allow"), "GET, HEAD, OPTIONS");
});

test("unsupported methods return 405", async () => {
  const response = await onRequest({ request: request("POST") });
  assert.equal(response.status, 405);
  const payload = await response.json();
  assert.deepEqual(payload.allow, ["GET", "HEAD", "OPTIONS"]);
});

test("video IDs outside the approved catalog return 404", async () => {
  const response = await onRequest({ request: request("GET", "/api/videos?id=unapproved-video") });
  assert.equal(response.status, 404);
  assert.equal((await response.json()).code, "VIDEO_NOT_FOUND");
});
