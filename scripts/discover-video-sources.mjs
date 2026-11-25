import { mkdir, writeFile } from "node:fs/promises";
import registry from "../data/video-provider-discovery.json" with { type: "json" };

const timeoutMs = 10000;
async function inspect(source) {
  const started = Date.now();
  try {
    const url = new URL(source.documentationUrl);
    if (url.protocol !== "https:") throw new Error("Documentation URL must use HTTPS");
    const response = await fetch(url, {
      method: "GET",
      redirect: "error",
      headers: { Accept: "text/html,application/json", "User-Agent": "ClipViet-ProviderDiscovery/1.0" },
      signal: AbortSignal.timeout(timeoutMs)
    });
    return {
      id: source.id,
      platform: source.platform,
      country: source.country,
      documentationUrl: source.documentationUrl,
      httpStatus: response.status,
      reachable: response.ok,
      bytesObserved: Number(response.headers.get("content-length")) || null,
      declaredStatus: source.status,
      access: source.access,
      rightsGate: source.rightsGate,
      checkedAt: new Date().toISOString(),
      latencyMs: Date.now() - started,
      note: "Reachability is not API approval, content ownership, consent, or a playback license."
    };
  } catch (error) {
    return {
      id: source.id,
      platform: source.platform,
      country: source.country,
      documentationUrl: source.documentationUrl,
      reachable: false,
      declaredStatus: source.status,
      checkedAt: new Date().toISOString(),
      latencyMs: Date.now() - started,
      error: String(error?.message || error).slice(0, 200)
    };
  }
}

const results = await Promise.all(registry.sources.map(inspect));
await mkdir("site/data", { recursive: true });
await writeFile("site/data/provider-discovery.json", JSON.stringify({
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  policy: registry.policy,
  results,
  coverageNotes: registry.coverageNotes
}, null, 2));
console.log(JSON.stringify({
  checked: results.length,
  reachable: results.filter(item => item.reachable).length,
  approvalRequired: results.filter(item => /approval|required|verification/.test(item.declaredStatus)).length,
  countries: [...new Set(results.map(item => item.country))]
}, null, 2));
