import { NextResponse } from "next/server";
import { PORTALS } from "@/lib/registry";
import { getLatestObservations } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const latest = await getLatestObservations();
    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      portals: PORTALS.map((portal) => ({
        ...portal,
        latest: latest[portal.id] || null
      }))
    }, {
      headers: { "Cache-Control": "no-store" }
    });
  } catch (error: any) {
    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      database: false,
      warning: error?.message || String(error),
      portals: PORTALS.map((portal) => ({ ...portal, latest: null }))
    }, { headers: { "Cache-Control": "no-store" } });
  }
}
