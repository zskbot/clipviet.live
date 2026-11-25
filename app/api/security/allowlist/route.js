import { NextResponse } from "next/server";
import { getVideoSecurityConfig } from "@/lib/embed-security.mjs";

export const dynamic = "force-dynamic";
export async function GET() {
  return NextResponse.json(getVideoSecurityConfig(), {
    headers: { "Cache-Control": "no-store" }
  });
}
