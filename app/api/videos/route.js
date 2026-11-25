import { NextResponse } from "next/server";
import { getVideoFeed } from "@/lib/video-provider";
import { getMacCmsVideoById } from "@/lib/maccms-provider.mjs";
import { searchVideos } from "@/lib/video-search.mjs";

export const revalidate = 60;
export async function GET(request) {
  try {
    const params = new URL(request.url).searchParams;
    const id = params.get("id");
    if (id?.startsWith("maccms:")) {
      const result = await getMacCmsVideoById(id);
      if (!result) return NextResponse.json({ success: false, error: "Video not found" }, { status: 404 });
      return NextResponse.json({ success: true, result, source: "maccms" }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
    }
    const { results, source, providerStatus, providerErrors } = await getVideoFeed();
    if (id) {
      const result = results.find(video => video.id === id);
      if (!result) return NextResponse.json({ success: false, error: "Video not found" }, { status: 404 });
      return NextResponse.json({ success: true, result, source }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
    }
    let page;
    try {
      page = searchVideos(results, params);
    } catch (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    return NextResponse.json({
      success: true,
      ...page,
      source,
      providerStatus: providerStatus || [],
      providerErrors: providerErrors || [],
      updatedAt: new Date().toISOString()
    }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
  } catch (error) {
    console.error("[videos-api]", error);
    return NextResponse.json({ success: false, error: "Video feed is temporarily unavailable" }, { status: 502 });
  }
}
