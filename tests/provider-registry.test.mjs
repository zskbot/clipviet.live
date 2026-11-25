import test from "node:test";
import assert from "node:assert/strict";
import { validateProviderInput, transitionAllowed } from "../workers/provider-registry/src/index.mjs";
import { encryptCredential, decryptCredential } from "../workers/provider-registry/src/security.mjs";

const valid = {
  name: "Authorized demo provider",
  apiBaseUrl: "https://api.example.com/v1/videos",
  apiHost: "api.example.com",
  mediaHosts: ["cdn.example.com"],
  rightsHolder: "Example Media Ltd",
  licenseReference: "LIC-2026-001",
  rightsEvidenceUrl: "https://example.com/licenses/clipviet.pdf",
  licenseExpiresAt: "2099-01-01T00:00:00.000Z",
  distributionRightsAttested: true,
  apiCredential: ""
};

test("accepts a complete HTTPS provider declaration", () => {
  assert.equal(validateProviderInput(valid).data.apiHost, "api.example.com");
});
test("rejects HTTP, IP literals, custom ports and host mismatch", () => {
  assert.ok(validateProviderInput({...valid,apiBaseUrl:"http://api.example.com"}).error);
  assert.ok(validateProviderInput({...valid,apiBaseUrl:"https://127.0.0.1"}).error);
  assert.ok(validateProviderInput({...valid,apiBaseUrl:"https://api.example.com:8443"}).error);
  assert.ok(validateProviderInput({...valid,apiHost:"other.example.com"}).error);
});
test("rejects credential-bearing query parameters", () => {
  assert.ok(validateProviderInput({...valid,apiBaseUrl:"https://api.example.com/v1?api_key=secret"}).error);
});
test("requires distribution-rights attestation and future license", () => {
  assert.ok(validateProviderInput({...valid,distributionRightsAttested:false}).error);
  assert.ok(validateProviderInput({...valid,licenseExpiresAt:"2000-01-01"}).error);
});
test("only reviewer roles can advance their exact state transition", () => {
  const tech = {apiReachable:true,schemaValid:true,mediaProbePassed:true,redirectsRejected:true,exactHostAllowlist:true,testRunId:"run-1"};
  const legal = {distributionPermissionReviewed:true,contentRightsReviewed:true,performerAgeVerified:true,performerConsentVerified:true,complaintsProcessVerified:true,takedownProcessVerified:true,distributionPermissionReference:"permission-1",contentRightsReference:"rights-1",ageVerificationReference:"age-1",consentRecordReference:"consent-1",complaintsProcessReference:"complaints-1",takedownProcessReference:"takedown-1",reviewReference:"legal-review-1"};
  assert.equal(transitionAllowed("PENDING","VERIFIED","technical",tech),true);
  assert.equal(transitionAllowed("PENDING","VERIFIED","admin",tech),false);
  assert.equal(transitionAllowed("VERIFIED","APPROVED","legal",legal),true);
  assert.equal(transitionAllowed("VERIFIED","APPROVED","technical",legal),false);
  assert.equal(transitionAllowed("VERIFIED","APPROVED","legal",{...legal,performerConsentVerified:false}),false);
  assert.equal(transitionAllowed("APPROVED","ENABLED","admin",{}),false);
  assert.equal(transitionAllowed("APPROVED","ENABLED","admin",{explicitEnableConfirmation:true}),true);
  assert.equal(transitionAllowed("PENDING","ENABLED","admin",{}),false);
});

test("rejects malformed or oversized API credentials instead of silently truncating", () => {
  assert.ok(validateProviderInput({...valid,apiCredential:{token:"secret"}}).error);
  assert.ok(validateProviderInput({...valid,apiCredential:"x".repeat(4097)}).error);
});
test("rejects local and IP-based media hostnames", () => {
  assert.ok(validateProviderInput({...valid,mediaHosts:["127.0.0.1"]}).error);
  assert.ok(validateProviderInput({...valid,mediaHosts:["metadata.internal"]}).error);
  assert.ok(validateProviderInput({...valid,mediaHosts:["[::1]"]}).error);
});
test("requires explicit evidence for every state transition", () => {
  assert.equal(transitionAllowed("PENDING","VERIFIED","technical",{}),false);
  assert.equal(transitionAllowed("VERIFIED","APPROVED","legal",{}),false);
  assert.equal(transitionAllowed("APPROVED","ENABLED","admin",{explicitEnableConfirmation:true}),true);
  assert.equal(transitionAllowed("ENABLED","APPROVED","admin",{}),false);
});

test("encrypts credentials with a versioned key id and decrypts with the matching key ring", async () => {
  const keyA = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
  const keyB = "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=";
  const oldEnv = { REGISTRY_ENCRYPTION_KEYS: JSON.stringify({activeKid:"k1",keys:{k1:keyA}}) };
  const newEnv = { REGISTRY_ENCRYPTION_KEYS: JSON.stringify({activeKid:"k2",keys:{k1:keyA,k2:keyB}}) };
  const cipher = await encryptCredential("preview-secret", oldEnv, "provider-1");
  assert.match(cipher, /^v1:k1:/);
  assert.equal(await decryptCredential(cipher, newEnv, "provider-1"), "preview-secret");
  const rotated = await encryptCredential(await decryptCredential(cipher,newEnv,"provider-1"),newEnv,"provider-1");
  assert.match(rotated,/^v1:k2:/);
  assert.equal(await decryptCredential(rotated,newEnv,"provider-1"),"preview-secret");
  await assert.rejects(() => decryptCredential(rotated,oldEnv,"provider-1"));
});
test("rejects an incomplete encryption key ring", async () => {
  await assert.rejects(() => encryptCredential("secret",{REGISTRY_ENCRYPTION_KEYS:"{}"},"provider-1"));
});
