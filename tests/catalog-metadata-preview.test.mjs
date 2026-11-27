import test from "node:test";
import assert from "node:assert/strict";
import { onRequest } from "../functions/api/catalog/[[path]].js";

test("metadata catalog returns paginated uploader-declared public-domain records without playback URLs", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  globalThis.fetch = async (input) => {
    requestedUrl = String(input);
    return new Response(JSON.stringify({
      response: {
        numFound: 43,
        docs: [{
          identifier: "prelinger-test-film",
          title: "A Public Domain Test Film",
          date: "1942",
          year: "1942",
          creator: "Prelinger Archives",
          description: "An archived public-domain film.",
          subject: ["history"],
          licenseurl: "http://creativecommons.org/licenses/publicdomain/"
        }]
      }
    }), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const response = await onRequest({
      request: new Request("https://preview.example/api/catalog/videos?page=2&limit=10")
    });
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.total, 43);
    assert.equal(payload.page, 2);
    assert.equal(payload.limit, 10);
    assert.equal(payload.pageCount, 5);
    assert.equal(payload.items.length, 1);
    assert.equal(payload.items[0].title, "A Public Domain Test Film");
    assert.match(payload.items[0].poster, /archive\.org\/services\/img/);
    assert.equal(payload.items[0].playbackEnabled, false);
    assert.equal(payload.items[0].playbackRightsApproved, false);
    assert.deepEqual(payload.items[0].lines, []);
    assert.match(decodeURIComponent(requestedUrl), /licenseurl:http\*publicdomain\*/);
    assert.match(decodeURIComponent(requestedUrl), /collection:prelinger/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("catalog rejects an item without a Public Domain license declaration", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    response: {
      numFound: 1,
      docs: [{ identifier: "no-license", title: "Unlicensed item", licenseurl: "" }]
    }
  }), { status: 200, headers: { "content-type": "application/json" } });
  try {
    const response = await onRequest({
      request: new Request("https://preview.example/api/catalog/videos?page=1")
    });
    const payload = await response.json();
    assert.equal(payload.items.length, 0);
    assert.equal(payload.total, 1);
    assert.equal(payload.rightsGate.playbackEnabled, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
