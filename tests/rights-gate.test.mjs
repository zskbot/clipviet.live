import test from "node:test";
import assert from "node:assert/strict";
import { validateConnectorContract, validateContentRights, canApproveContentRights, playbackDecision } from "../workers/provider-registry/src/rights-gate.mjs";

const connector = {
  connectorId: "youtube-data-api", authMode: "api_key", scopes: ["youtube.readonly"],
  regions: ["VN", "KR", "CN"], playbackMode: "official_embed",
  documentationUrl: "https://developers.google.com/youtube/v3"
};
const rights = {
  sourcePlatform: "YouTube", sourceContentId: "video-123",
  sourceUrl: "https://www.youtube.com/watch?v=video-123", creator: "Verified creator",
  rightsHolder: "Creator Media Ltd", licenseReference: "LIC-001",
  evidenceUrl: "https://creator.example.com/licenses/LIC-001.pdf",
  licenseExpiresAt: "2099-01-01T00:00:00.000Z",
  permittedUses: ["official_embed"], regions: ["VN", "KR"],
  sourceVerified: true, ownershipVerified: true, performerAgeVerified: true, performerConsentVerified: true
};

test("accepts documented connector contract with explicit auth, scopes, territory and playback mode", () => {
  assert.equal(validateConnectorContract(connector).data.playbackMode, "official_embed");
});
test("rejects connector credential leakage, unknown playback modes and unauthenticated scopes", () => {
  assert.ok(validateConnectorContract({...connector, documentationUrl:"https://api.example.com/docs?api_key=secret"}).error);
  assert.ok(validateConnectorContract({...connector, playbackMode:"download_everything"}).error);
  assert.ok(validateConnectorContract({...connector, authMode:"none"}).error);
});
test("metadata-only connectors cannot claim stream rights by implication", () => {
  const result = validateConnectorContract({...connector, playbackMode:"metadata_only"});
  assert.equal(result.data.playbackMode, "metadata_only");
});
test("requires clip-level provenance, owner, license, territory, adult age and consent evidence", () => {
  assert.equal(validateContentRights(rights).data.sourceContentId, "video-123");
  assert.ok(validateContentRights({...rights, sourceVerified:false}).error);
  assert.ok(validateContentRights({...rights, performerConsentVerified:false}).error);
  assert.ok(validateContentRights({...rights, permittedUses:[]}).error);
  assert.ok(validateContentRights({...rights, regions:[]}).error);
  assert.ok(validateContentRights({...rights, sourceUrl:"http://youtube.com/video"}).error);
});
test("only legal reviewer can approve a complete pending clip rights record", () => {
  const row = {status:"PENDING",source_verified:1,ownership_verified:1,performer_age_verified:1,performer_consent_verified:1,license_expires_at:"2099-01-01T00:00:00.000Z"};
  const evidence = {permissionReference:"p-1",ownershipReference:"o-1",ageReference:"a-1",consentReference:"c-1",reviewReference:"r-1"};
  assert.equal(canApproveContentRights(row,"legal",evidence),true);
  assert.equal(canApproveContentRights(row,"admin",evidence),false);
  assert.equal(canApproveContentRights({...row,performer_consent_verified:0},"legal",evidence),false);
});
test("playback requires enabled provider, approved per-clip rights, licensed use and territory", () => {
  const provider = {status:"ENABLED",license_expires_at:"2099-01-01T00:00:00.000Z",playback_mode:"official_embed"};
  const content = {status:"APPROVED",license_expires_at:"2099-01-01T00:00:00.000Z",permitted_uses_json:'["official_embed"]',regions_json:'["VN","KR"]',source_verified:1,ownership_verified:1,performer_age_verified:1,performer_consent_verified:1,source_url:"https://youtube.com/watch?v=1"};
  assert.equal(playbackDecision({provider,content,requestedUse:"official_embed",region:"VN"}).allowed,true);
  assert.equal(playbackDecision({provider:{...provider,playback_mode:"metadata_only"},content,requestedUse:"official_embed",region:"VN"}).reason,"connector_does_not_support_playback");
  assert.equal(playbackDecision({provider,content,requestedUse:"owner_hosted_stream",region:"VN"}).reason,"requested_use_not_licensed");
  assert.equal(playbackDecision({provider,content,requestedUse:"official_embed",region:"CN"}).reason,"territory_not_licensed");
  assert.equal(playbackDecision({provider:{...provider,connector_regions:["VN"]},content,requestedUse:"official_embed",region:"KR"}).reason,"connector_region_not_supported");
  assert.equal(playbackDecision({provider:{...provider,status:"APPROVED"},content,requestedUse:"official_embed",region:"VN"}).reason,"provider_not_enabled");
  assert.equal(playbackDecision({provider,content:{...content,status:"PENDING"},requestedUse:"official_embed",region:"VN"}).reason,"content_rights_not_approved");
});


test("redistribution requires an owner-hosted connector mode", () => {
  const provider = {status:"ENABLED",license_expires_at:"2099-01-01T00:00:00.000Z",playback_mode:"official_embed"};
  const content = {status:"APPROVED",license_expires_at:"2099-01-01T00:00:00.000Z",permitted_uses_json:'["redistribute"]',regions_json:'["VN"]',source_verified:1,ownership_verified:1,performer_age_verified:1,performer_consent_verified:1,source_url:"https://creator.example.com/video/1"};
  assert.equal(playbackDecision({provider,content,requestedUse:"redistribute",region:"VN"}).reason,"connector_redistribution_mode_mismatch");
  assert.equal(playbackDecision({provider:{...provider,playback_mode:"owner_hosted_stream"},content,requestedUse:"redistribute",region:"VN"}).allowed,true);
});
