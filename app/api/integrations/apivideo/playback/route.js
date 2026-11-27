import { NextResponse } from "next/server";
import { isAdminAuthorized } from "@/lib/admin-cms";
import {
  getApiVideoApiBaseUrl,
  getApprovedApiVideoPlayback
} from "@/lib/apivideo.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const id = new URL(request.url).searchParams.get("id") || "";
  const approved = getApprovedApiVideoPlayback(id);
  if (!approved) {
    return NextResponse.json(
      { success: false, enabled: false, error: "API.video playback is not approved for this video." },
      { status: 404, headers: { "Cache-Control": "no-store" } }
    );
  }

  if (approved.private) {
    if (!isAdminAuthorized(request)) {
      return NextResponse.json(
        { success: false, enabled: false, error: "Private video playback requires an authorized Preview admin session." },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }
    const apiKey = String(process.env.APIVIDEO_API_KEY || "").trim();
    const apiBaseUrl = getApiVideoApiBaseUrl(process.env);
    if (!apiKey || !apiBaseUrl) {
      return NextResponse.json(
        { success: false, enabled: false, error: "Sandbox API key is not configured for private playback." },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }
    try {
      // api.video generates a fresh, one-time private playback token on each GET.
      const response = await fetch(apiBaseUrl + "/videos/" + encodeURIComponent(approved.id), {
        headers: {
          Authorization: "Basic " + Buffer.from(apiKey + ":").toString("base64"),
          Accept: "application/json"
        },
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(12000)
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        return NextResponse.json(
          { success: false, enabled: false, error: "api.video could not issue a private playback token.", providerStatus: response.status },
          { status: 502, headers: { "Cache-Control": "no-store" } }
        );
      }
      let token = "";
      try {
        token = new URL(payload.assets?.player || "").searchParams.get("token") || "";
      } catch {}
      if (!token || !/^[A-Za-z0-9-]{16,128}$/.test(token)) {
        return NextResponse.json(
          { success: false, enabled: false, error: "api.video did not return a valid private playback token." },
          { status: 502, headers: { "Cache-Control": "no-store" } }
        );
      }
      return NextResponse.json(
        { success: true, enabled: true, videoId: approved.id, live: approved.live, token, private: true },
        { headers: { "Cache-Control": "no-store", Pragma: "no-cache" } }
      );
    } catch {
      return NextResponse.json(
        { success: false, enabled: false, error: "api.video private playback request failed or timed out." },
        { status: 502, headers: { "Cache-Control": "no-store" } }
      );
    }
  }

  return NextResponse.json(
    { success: true, enabled: true, videoId: approved.id, live: approved.live, private: false },
    { headers: { "Cache-Control": "no-store" } }
  );
}
