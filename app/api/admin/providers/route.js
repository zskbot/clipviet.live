import { NextResponse } from "next/server";
import { isAdminAuthorized } from "@/lib/admin-cms";
import { getMacCmsFeed, getMacCmsProviderConfig } from "@/lib/maccms-provider.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isPreviewDeployment() {
  if (process.env.VERCEL_ENV) return process.env.VERCEL_ENV === "preview";
  if (process.env.NETLIFY !== "true") return false;
  try {
    const host = new URL(process.env.DEPLOY_PRIME_URL || "").hostname;
    return /^deploy-preview-\d+--[a-z0-9-]+\.netlify\.app$/i.test(host);
  } catch {
    return false;
  }
}

export async function GET(request) {
  if (!isPreviewDeployment()) {
    return NextResponse.json({ success: false, error: "Preview only" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  try {
    const [feed, configured] = await Promise.all([getMacCmsFeed(), Promise.resolve(getMacCmsProviderConfig())]);
    return NextResponse.json({
      success: true,
      providers: feed.providers,
      errors: feed.errors,
      configured,
      totalVideos: feed.results.length,
      checkedAt: new Date().toISOString()
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Provider check failed" }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
