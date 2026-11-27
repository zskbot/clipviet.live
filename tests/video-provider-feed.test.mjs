import test from "node:test";
import assert from "node:assert/strict";
import { getVideoFeed } from "../lib/video-provider.js";

test("public catalog does not inject demo records when provider rights are pending", async () => {
  const keys = ["TELEGRAM_PUBLIC_POSTS_JSON", "VIDEO_MACCMS_PROVIDERS_JSON", "VIDEO_API_ALLOWED_HOSTS",
    "VIDEO_PROVIDER_RIGHTS_JSON", "VIDEO_VIDEO_RIGHTS_JSON", "NETLIFY", "DEPLOY_PRIME_URL"];
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  const originalFetch = globalThis.fetch;
  let upstreamCalls = 0;
  for (const key of keys) delete process.env[key];
  process.env.TELEGRAM_PUBLIC_POSTS_JSON = "[]";
  globalThis.fetch = async () => { upstreamCalls += 1; throw new Error("pending providers must not be contacted"); };
  try {
    const result = await getVideoFeed();
    assert.deepEqual(result.results, []);
    assert.equal(result.source, "none");
    assert.equal(result.providerStatus.length, 5);
    assert.equal(result.providerStatus.every(provider => provider.state === "rights_pending"), true);
    assert.equal(upstreamCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});
