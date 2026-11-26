import { Actor } from "apify";
import { createCheerioRouter } from "crawlee";

const excludedPath = /\/(?:category|categories|tag|tags|page|author|search|feed|wp-json|wp-admin|login|register)(?:\/|$)/i;
const trackingParams = /^(?:utm_.+|fbclid|gclid|ref|source|campaign)$/i;

function canonicalize(raw) {
  try {
    const url = new URL(raw);
    if (!["https:", "http:"].includes(url.protocol)) return null;
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) if (trackingParams.test(key)) url.searchParams.delete(key);
    url.searchParams.sort();
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
    return url.href;
  } catch { return null; }
}

function videoCandidate(url, host) {
  const path = new URL(url).pathname;
  if (excludedPath.test(path)) return false;
  if (host === "hsex.men") return /^\/video-\d+\.htm$/i.test(path);
  if (host === "viet69.be") return /^\/bai-viet\/[a-z0-9-]+\/?$/i.test(path) || /^\/[a-z0-9-]+\/?$/i.test(path);
  if (["sexonline.blog", "sexvn.co", "javhay.onl"].includes(host)) return /^\/[a-z0-9][a-z0-9-]{2,}\/?$/i.test(path);
  return false;
}

function paginationCandidates(url, host, $) {
  const links = new Set();
  $("a[href]").each((_, node) => {
    const raw = $(node).attr("href");
    if (!raw) return;
    const canonical = canonicalize(new URL(raw, url).href);
    if (!canonical) return;
    const candidate = new URL(canonical);
    const pagePath = /\/page\/\d+\/?$/i.test(candidate.pathname);
    const hsexList = host === "hsex.men" && /\/list-\d+\.htm$/i.test(candidate.pathname);
    const queryPage = candidate.searchParams.has("page");
    const tagPage = host === "viet69.be" && /\/tag\/[^/]+\/page\/\d+\/?$/i.test(candidate.pathname);
    if (pagePath || hsexList || queryPage || tagPage) links.add(canonical);
  });
  return [...links];
}

function pageNumber(url) {
  const parsed = new URL(url);
  const pathMatch = parsed.pathname.match(/(?:list-|\/page\/)(\d+)(?:\.htm)?\/?$/i);
  return Number(pathMatch?.[1] || parsed.searchParams.get("page") || 1);
}

export function createRouter({ allowedDomains, maxPages, isAllowedByRobots, seen }) {
  const router = createCheerioRouter();
  router.addDefaultHandler(async ({ request, $, enqueueLinks, log }) => {
    const current = new URL(request.url);
    const host = current.hostname.toLowerCase();
    if (!allowedDomains.includes(host)) return;
    const sourceRoot = request.userData.sourceRoot || current.origin;
    const pageDepth = Number(request.userData.pageDepth) || 1;
    const currentPage = pageNumber(request.url);

    if (pageDepth < maxPages) {
      const nextUrl = paginationCandidates(request.url, host, $)
        .filter((value) => new URL(value).origin === sourceRoot)
        .filter((value) => pageNumber(value) > currentPage)
        .sort((a, b) => pageNumber(a) - pageNumber(b))[0];
      if (nextUrl && await isAllowedByRobots(nextUrl)) {
        await enqueueLinks({
          urls: [nextUrl],
          transformRequestFunction: (next) => {
            next.userData = { ...next.userData, sourceRoot, pageDepth: pageDepth + 1 };
            return next;
          }
        });
      }
    }

    const output = [];
    $("a[href]").each((_, node) => {
      const href = $(node).attr("href");
      if (!href) return;
      const canonical = canonicalize(new URL(href, request.url).href);
      if (!canonical) return;
      const target = new URL(canonical);
      if (target.hostname.toLowerCase() !== host || !videoCandidate(canonical, host)) return;
      const title = String($(node).attr("title") || $(node).text() || "").replace(/\s+/g, " ").trim().slice(0, 240);
      const videoId = target.searchParams.get("video_key")
        || target.pathname.match(/video-(\d+)\.htm/i)?.[1]
        || target.pathname.split("/").filter(Boolean).at(-1)
        || canonical;
      const dedupeKey = host + ":" + String(videoId).toLowerCase();
      if (seen.has(dedupeKey)) return;
      seen.add(dedupeKey);
      output.push({
        recordType: "video_page",
        videoUrl: canonical,
        canonicalUrl: canonical,
        videoId: String(videoId),
        dedupeKey,
        sourceDomain: host,
        title: title || null,
        discoveredFrom: request.url,
        discoveredAt: new Date().toISOString(),
        rightsStatus: "PENDING"
      });
    });
    for (const record of output) await Actor.pushData(record);
    log.info("Listing processed", { url: request.url, candidates: output.length, pageDepth, maxPages });
  });
  return router;
}
