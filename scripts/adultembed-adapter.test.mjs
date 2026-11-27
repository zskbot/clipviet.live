import test from "node:test";
import assert from "node:assert/strict";
import { buildAdultEmbedSearchUrl, normalizeAdultEmbedSearch, adultEmbedIntegrationStatus } from "./adultembed-adapter.mjs";

test("search URL is pinned to AdultEmbed and bounded to 20 records", () => {
  const url = buildAdultEmbedSearchUrl({ query: "  sample  ", page: 2, perPage: 100, sort: "popular" });
  assert.equal(url.origin, "https://adultembed.com");
  assert.equal(url.pathname, "/api/v1/search");
  assert.equal(url.searchParams.get("query"), "sample");
  assert.equal(url.searchParams.get("per_page"), "20");
  assert.equal(url.searchParams.get("quality"), "complete");
});

test("normalizer returns metadata only and keeps playback disabled", () => {
  const result = normalizeAdultEmbedSearch({ page: 1, per_page: 1, total: 1, pages: 1, results: [{
    id: 123, title: "Licensed adult performer scene", description: "Metadata only",
    thumbnail: "https://cdn.example.test/poster.webp", duration: "12:34",
    categories: [{ name: "Category" }], tags: ["tag"], performers: [{ name: "Performer" }]
  }] });
  assert.equal(result.results.length, 1);
  assert.equal(result.results[0].sourceId, "adultembed");
  assert.equal(result.results[0].playbackEnabled, false);
  assert.equal(result.results[0].rightsStatus, "PENDING");
});

test("normalizer drops unsafe URLs and age-risk labels", () => {
  const result = normalizeAdultEmbedSearch({ results: [
    { id: 1, title: "Valid title", thumbnail: "http://insecure.test/a.jpg" },
    { id: 2, title: "School girl scene" }
  ] });
  assert.equal(result.results.length, 1);
  assert.equal(result.results[0].poster, "");
});

test("status remains deny-by-default", () => {
  const status = adultEmbedIntegrationStatus();
  assert.equal(status.providerStatus, "PENDING");
  assert.equal(status.metadataEnabled, false);
  assert.equal(status.playbackEnabled, false);
});
