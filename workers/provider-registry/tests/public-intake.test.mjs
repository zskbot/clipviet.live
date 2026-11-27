import test from "node:test";
import assert from "node:assert/strict";
import { validateMetadataIntake } from "../src/public-intake.mjs";

const valid = {
  providerId: "souavzy",
  rightsHolder: "Example Rights Ltd",
  licenseReference: "META-2026-001",
  evidenceUrl: "https://rights.example.com/clipviet-metadata-license",
  documentationUrl: "https://api.souavzy.vip/docs",
  licenseExpiresAt: "2099-12-31",
  regions: ["VN"],
  contactEmail: "legal@example.com",
  metadataOnlyAttestation: true
};

test("accepts a complete metadata-only intake for a fixed provider", () => {
  const result = validateMetadataIntake(valid);
  assert.equal(result.error, undefined);
  assert.equal(result.data.provider.id, "souavzy");
  assert.deepEqual(result.data.regions, ["VN"]);
});

test("rejects arbitrary providers and upstream hosts", () => {
  assert.match(validateMetadataIntake({ ...valid, providerId: "attacker.example" }).error, /provider/i);
});

test("rejects non-HTTPS evidence and API documentation", () => {
  assert.ok(validateMetadataIntake({ ...valid, evidenceUrl: "http://rights.example.com/license" }).error);
  assert.ok(validateMetadataIntake({ ...valid, documentationUrl: "javascript:alert(1)" }).error);
});

test("rejects expired licenses and missing regions", () => {
  assert.ok(validateMetadataIntake({ ...valid, licenseExpiresAt: "2000-01-01" }).error);
  assert.ok(validateMetadataIntake({ ...valid, regions: [] }).error);
});

test("does not accept API credentials or arbitrary media URLs as configuration fields", () => {
  const result = validateMetadataIntake({ ...valid, apiCredential: "must-not-be-stored", streamUrl: "https://cdn.example/stream.m3u8" });
  assert.equal(result.error, undefined);
  assert.equal("apiCredential" in result.data, false);
  assert.equal("streamUrl" in result.data, false);
});
