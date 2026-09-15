import { NextResponse } from "next/server";
import { PORTALS } from "@/lib/registry";
import { getHistory, getLatestObservations } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [latest, history] = await Promise.all([
      getLatestObservations(),
      getHistory(2000)
    ]);

    return NextResponse.json({
      exportedAt: new Date().toISOString(),
      methodology:
        "Production server-side passive public GET monitor. Static allowlist only; redirects revalidated; private/reserved IPs blocked; no login, credentials or personal-data submission; raw HTML is not stored.",
      portals: PORTALS.map((p) => ({ ...p, latest: latest[p.id] || null })),
      history
    }, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="digital-seba-production-export.json"`
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Export failed" }, { status: 503 });
  }
}
