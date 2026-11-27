import test from "node:test";
import assert from "node:assert/strict";
import { evaluateAdultGeoPolicy } from "../src/adult-geo-policy.mjs";

const enabledEnv = { ADULT_ALLOWED_COUNTRIES: "US,CA", ADULT_CONTENT_ENABLED: "true", ADULT_PROVIDER_RIGHTS_CONFIRMED: "true" };

test("synthetic US edge country is allowed only when explicitly allowlisted and rights are confirmed", () => {
  const result = evaluateAdultGeoPolicy({ cf: { country: "US" }, headers: new Headers({ "CF-IPCountry": "VN" }) }, enabledEnv);
  assert.equal(result.country, "US");
  assert.equal(result.allowed, true);
  assert.equal(result.enabled, true);
  assert.equal(result.reason, "geo_allowed");
});

test("Vietnam is hard-blocked even if mistakenly added to the allowlist", () => {
  const result = evaluateAdultGeoPolicy({ cf: { country: "VN" } }, { ...enabledEnv, ADULT_ALLOWED_COUNTRIES: "US,VN" });
  assert.equal(result.allowed, false);
  assert.equal(result.enabled, false);
  assert.equal(result.reason, "country_blocked");
});

test("unknown and non-allowlisted countries are denied", () => {
  assert.equal(evaluateAdultGeoPolicy({ cf: {} }, enabledEnv).reason, "country_unknown");
  assert.equal(evaluateAdultGeoPolicy({ cf: { country: "GB" } }, enabledEnv).reason, "country_not_allowlisted");
});

test("provider rights and feature flags fail closed", () => {
  const request = { cf: { country: "US" } };
  assert.equal(evaluateAdultGeoPolicy(request, { ...enabledEnv, ADULT_CONTENT_ENABLED: "false" }).enabled, false);
  assert.equal(evaluateAdultGeoPolicy(request, { ...enabledEnv, ADULT_PROVIDER_RIGHTS_CONFIRMED: "false" }).enabled, false);
});

test("client-supplied country headers cannot override Cloudflare edge country", () => {
  const result = evaluateAdultGeoPolicy({ cf: { country: "VN" }, headers: new Headers({ "CF-IPCountry": "US" }) }, enabledEnv);
  assert.equal(result.country, "VN");
  assert.equal(result.allowed, false);
});
