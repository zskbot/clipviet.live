import test from "node:test";
import assert from "node:assert/strict";
import { listProviderStatuses, checkProviderHealth } from "../src/applecms.js";

const providerRows = ["souavzy", "apiyutu", "lbapi9", "slapibf", "jipinvip1"].map(id => ({
  id, provider_status: "PENDING", connector_status: null, playback_mode: null,
  rights_holder: "", license_reference: "", rights_evidence_url: "", license_expires_at: "",
  regions_json: "[]", approved_content_count: 0
}));
const envWithPendingRegistry = () => ({
  APPLECMS_SOUAVZY_URL: "https://api.souavzy.vip/api.php/provide/vod/",
  APPLECMS_APIYUTU_URL: "https://apiyutu.com/api.php/provide/vod/",
  APPLECMS_LBAPI9_URL: "https://lbapi9.com/api.php/provide/vod/",
  APPLECMS_SLAPIBF_URL: "https://slapibf.com/api.php/provide/vod/",
  APPLECMS_JIPINVIP1_URL: "https://jipinvip1.com/api.php/provide/vod/",
  PROVIDER_DB: {
    prepare(sql) {
      return {
        bind() {
          return {
            all: async () => ({ results: providerRows }),
            first: async () => ({ provider_status: "PENDING", connector_status: null })
          };
        }
      };
    }
  }
});

test("provider status reports all five sources as pending without exposing credentials", async () => {
  const result = await listProviderStatuses(envWithPendingRegistry());
  assert.equal(result.length, 5);
  assert.equal(result.every(provider => provider.configured), true);
  assert.equal(result.every(provider => provider.status === "PENDING_RIGHTS"), true);
  assert.equal(result.every(provider => provider.approvedContentCount === 0), true);
  assert.equal(result.some(provider => "api_credential_ciphertext" in provider), false);
});

test("provider health check does not contact an unapproved upstream", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; throw new Error("pending provider must not be contacted"); };
  try {
    const result = await checkProviderHealth("souavzy", envWithPendingRegistry());
    assert.equal(result.status, "pending-rights");
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
