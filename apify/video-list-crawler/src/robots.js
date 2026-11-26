import robotsParser from "robots-parser";

const cache = new Map();
export async function isAllowedByRobots(rawUrl) {
  const url = new URL(rawUrl);
  const origin = url.origin;
  if (!cache.has(origin)) {
    const promise = (async () => {
      try {
        const response = await fetch(new URL("/robots.txt", origin), { signal: AbortSignal.timeout(8000), headers: { "User-Agent": "ClipVietMetadataCrawler/0.1 (+robots-aware; contact site owner)" } });
        if (!response.ok) return null;
        const body = await response.text();
        return robotsParser(new URL("/robots.txt", origin).href, body);
      } catch { return null; }
    })();
    cache.set(origin, promise);
  }
  const parser = await cache.get(origin);
  // Fail closed when robots.txt cannot be fetched or parsed.
  return Boolean(parser && parser.isAllowed(url.href, "ClipVietMetadataCrawler"));
}
