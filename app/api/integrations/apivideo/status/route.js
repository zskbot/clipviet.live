import { NextResponse } from "next/server";
import { getApiVideoIntegrationStatus } from "@/lib/apivideo.mjs";

export const dynamic = "force-dynamic";

export async function GET() {
  const status = getApiVideoIntegrationStatus();
  return NextResponse.json(
    { success: true, provider: "api.video", ...status },
    { headers: { "Cache-Control": "no-store" } }
  );
}
