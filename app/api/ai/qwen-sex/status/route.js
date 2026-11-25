import { NextResponse } from "next/server";
import { getQwen25SexProviderStatus } from "@/lib/qwen25-sex-provider.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const status = getQwen25SexProviderStatus();

  return NextResponse.json(
    {
      provider: status,
      policy: {
        adultContentGeneration: "disabled",
        minorSexualContent: "prohibited",
        nonConsensualSexualContent: "prohibited",
        violenceAndIllegalContent: "requires-human-review",
        adminAuthorization: "handled-separately-from-ai",
      },
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    }
  );
}
