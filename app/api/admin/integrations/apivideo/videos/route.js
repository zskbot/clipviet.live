import { NextResponse } from "next/server";
import { isAdminAuthorized } from "@/lib/admin-cms";
import {
  getApiVideoApiBaseUrl,
  validateApiVideoSourceUrl
} from "@/lib/apivideo.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  if (process.env.APIVIDEO_INGEST_ENABLED !== "true") {
    return NextResponse.json({ success: false, error: "API.video ingestion is disabled until Preview rights review and configuration are complete." }, { status: 403 });
  }

  const apiKey = String(process.env.APIVIDEO_API_KEY || "").trim();
  if (!apiKey) {
    return NextResponse.json({ success: false, error: "APIVIDEO_API_KEY is not configured in the server Preview environment." }, { status: 503 });
  }

  const production = process.env.APIVIDEO_ENV === "production";
  if (production && process.env.APIVIDEO_ALLOW_PRODUCTION_WRITES !== "true") {
    return NextResponse.json({ success: false, error: "Production API writes are disabled." }, { status: 403 });
  }

  let body;
  try { body = await request.json(); }
  catch { return NextResponse.json({ success: false, error: "Invalid JSON body." }, { status: 400 }); }

  const title = typeof body.title === "string" ? body.title.trim().slice(0, 240) : "";
  const description = typeof body.description === "string" ? body.description.trim().slice(0, 4000) : "";
  const source = validateApiVideoSourceUrl(body.sourceUrl, process.env);
  if (!title || !source || body.rightsConfirmed !== true) {
    return NextResponse.json({
      success: false,
      error: "A title, an approved HTTPS source host, and explicit rights confirmation are required."
    }, { status: 400 });
  }

  try {
    const response = await fetch(getApiVideoApiBaseUrl(process.env) + "/videos", {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(apiKey + ":").toString("base64"),
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({ title, description, source, public: false }),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(15000)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json({
        success: false,
        error: "api.video rejected the create request.",
        providerStatus: response.status
      }, { status: response.status >= 400 && response.status < 600 ? response.status : 502 });
    }
    return NextResponse.json({
      success: true,
      environment: production ? "production" : "sandbox",
      videoId: payload.videoId || payload.video_id || payload.id || null,
      public: false,
      status: "created_private"
    }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ success: false, error: "api.video request failed or timed out." }, { status: 502 });
  }
}
