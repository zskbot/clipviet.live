import { Actor } from "apify";
import { CheerioCrawler, RequestQueue } from "crawlee";
import { createRouter } from "./routes.js";
import { isAllowedByRobots } from "./robots.js";

await Actor.init();
const input = (await Actor.getInput()) || {};
const startUrls = Array.isArray(input.startUrls) ? input.startUrls : [];
const maxPages = Math.max(1, Math.min(100, Number(input.maxPages) || 2));
const maxRequestsPerCrawl = Math.max(1, Math.min(1000, Number(input.maxRequestsPerCrawl) || 100));
const allowedDomains = Array.isArray(input.allowedDomains) && input.allowedDomains.length
  ? input.allowedDomains.map((value) => String(value).toLowerCase())
  : ["hsex.men", "sexonline.blog", "sexvn.co", "viet69.be", "javhay.onl"];

if (!startUrls.length) throw new Error("At least one startUrls entry is required.");
const queue = await RequestQueue.open();
for (const entry of startUrls) {
  const raw = typeof entry === "string" ? entry : entry?.url;
  if (!raw) continue;
  const url = new URL(raw);
  if (url.protocol !== "https:" || !allowedDomains.includes(url.hostname.toLowerCase())) {
    throw new Error("Start URL must be HTTPS and use an explicitly allowed host: " + url.hostname);
  }
  if (await isAllowedByRobots(url.href)) await queue.addRequest({ url: url.href, userData: { sourceRoot: url.origin, pageDepth: 1 } });
}

const router = createRouter({ allowedDomains, maxPages, isAllowedByRobots });
const crawler = new CheerioCrawler({
  requestQueue: queue,
  maxRequestsPerCrawl,
  maxConcurrency: 2,
  requestHandlerTimeoutSecs: 30,
  navigationTimeoutSecs: 20,
  requestHandler: router,
  failedRequestHandler: async ({ request, error }) => {
    await Actor.pushData({
      recordType: "crawl_error",
      url: request.url,
      sourceDomain: new URL(request.url).hostname,
      error: String(error?.message || error).slice(0, 300),
      discoveredAt: new Date().toISOString()
    });
  }
});
await crawler.run();
await Actor.exit();
