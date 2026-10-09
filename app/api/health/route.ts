import { NextResponse } from "next/server";
import { porichoyConfigured, probePorichoyProvider } from "@/lib/porichoy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function probeBdris() {
  const base = process.env.BDRIS_BASE_URL?.replace(/\/+$/, "") || "https://everify.bdris.gov.bd";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(base, {
      method: "HEAD",
      cache: "no-store",
      redirect: "manual",
      signal: controller.signal
    });
    return {
      reachable: true,
      status: res.status,
      state: res.status >= 500 ? ("degraded" as const) : ("reachable" as const)
    };
  } catch {
    return {
      reachable: false,
      status: null as number | null,
      state: "unreachable" as const
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function GET() {
  const configured = porichoyConfigured();
  const [provider, bdris] = await Promise.all([probePorichoyProvider(), probeBdris()]);

  const birthMode = configured ? "porichoy" : "bdris";
  const birthReady =
    birthMode === "porichoy" ? configured && provider.reachable : bdris.reachable;

  return NextResponse.json(
    {
      ok: true,
      porichoyConfigured: configured,
      mode: configured ? "ready" : "bdris-fallback",
      provider: configured ? "Porichoy" : "BDRIS (official portal)",
      providerNetwork: provider,
      bdris: {
        reachable: bdris.reachable,
        status: bdris.status,
        state: bdris.state,
        portal: "https://everify.bdris.gov.bd/"
      },
      birthVerification: {
        mode: birthMode,
        ready: birthReady,
        captchaRequired: birthMode === "bdris"
      },
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
