import { NextResponse } from "next/server";
import { getApprovedApiVideoPlayback } from "@/lib/apivideo.mjs";

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
  return NextResponse.json(
    { success: true, enabled: true, videoId: approved.id, live: approved.live },
    { headers: { "Cache-Control": "no-store" } }
  );
}
