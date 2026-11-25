import { NextResponse } from "next/server";
import { isAdminAuthorized } from "@/lib/admin-cms";
import { getOcodejsOverview } from "@/lib/ocodejs-control.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, {
      status: 401,
      headers: { "Cache-Control": "no-store" },
    });
  }

  try {
    const result = await getOcodejsOverview();
    return NextResponse.json({ success: true, result }, {
      status: result.configured ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[ocodejs-control]", error);
    return NextResponse.json({ success: false, error: "OCodeJS configuration is invalid." }, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
