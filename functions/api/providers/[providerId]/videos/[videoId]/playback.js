const UPSTREAM = "https://clipviet-catalog-metadata-preview.huynhthuongg2505-f9b.workers.dev";
const PROVIDERS = new Set(["souavzy", "apiyutu", "lbapi9", "slapibf", "jipinvip1"]);

export async function onRequest({ request, params }) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", {
      status: 405,
      headers: { Allow: "GET, HEAD", "cache-control": "no-store" }
    });
  }

  const providerId = String(params?.providerId || "").toLowerCase();
  const videoId = String(params?.videoId || "");
  if (!PROVIDERS.has(providerId) || !/^[0-9]{1,40}$/.test(videoId)) {
    return new Response(JSON.stringify({
      success: false,
      error: "Invalid provider or video reference",
      code: "INVALID_VIDEO_REFERENCE"
    }), {
      status: 400,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
    });
  }

  try {
    const upstream = await fetch(
      UPSTREAM + "/api/providers/" + encodeURIComponent(providerId) + "/videos/" + encodeURIComponent(videoId) + "/playback",
      {
        method: request.method,
        headers: {
          Accept: request.headers.get("Accept") || "application/json",
          Origin: new URL(request.url).origin
        },
        redirect: "manual"
      }
    );
    const headers = new Headers(upstream.headers);
    headers.set("cache-control", "no-store");
    headers.set("x-content-type-options", "nosniff");
    headers.set("x-clipviet-playback-source", "rights-gated-catalog-worker");
    return new Response(upstream.body, { status: upstream.status, headers });
  } catch {
    return new Response(JSON.stringify({
      success: false,
      error: "Playback metadata service unavailable",
      code: "PLAYBACK_UPSTREAM_UNAVAILABLE"
    }), {
      status: 502,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff"
      }
    });
  }
}
