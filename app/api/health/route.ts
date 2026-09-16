import { NextResponse } from "next/server";
import { porichoyConfigured } from "@/lib/porichoy";

export const dynamic = "force-dynamic";

export async function GET() {
  const configured = porichoyConfigured();
  return NextResponse.json(
    {
      ok: true,
      porichoyConfigured: configured,
      mode: configured ? "ready" : "setup-required",
      provider: "Porichoy",
      time: new Date().toISOString()
    },
    {
      headers: {
        "cache-control": "no-store, max-age=0",
        pragma: "no-cache"
      }
    }
  );
}
