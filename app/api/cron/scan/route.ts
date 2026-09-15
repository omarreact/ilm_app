import { NextRequest, NextResponse } from "next/server";
import { PORTALS } from "@/lib/registry";
import { scanPortal } from "@/lib/scanner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorised(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!authorised(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: Array<{ id: string; category?: string; status?: number | null; error?: string }> = [];
  const queue = PORTALS.slice();

  const workers = Array.from({ length: 2 }, async () => {
    while (queue.length) {
      const portal = queue.shift();
      if (!portal) return;
      try {
        const obs = await scanPortal(portal, true);
        results.push({
          id: portal.id,
          category: obs.category,
          status: obs.status,
          error: obs.error || undefined
        });
      } catch (error: any) {
        results.push({ id: portal.id, error: error?.message || String(error) });
      }
    }
  });

  await Promise.all(workers);

  return NextResponse.json({
    checkedAt: new Date().toISOString(),
    results
  });
}
