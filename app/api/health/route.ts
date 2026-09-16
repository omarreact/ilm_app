import { NextResponse } from "next/server";
import { porichoyConfigured, probePorichoyProvider } from "@/lib/porichoy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const configured = porichoyConfigured();
  const provider = await probePorichoyProvider();

  return NextResponse.json(
    {
      ok: true,
      porichoyConfigured: configured,
      mode: configured ? "ready" : "setup-required",
      provider: "Porichoy",
      providerNetwork: provider,
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
