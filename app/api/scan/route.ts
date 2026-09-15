import { NextRequest, NextResponse } from "next/server";
import { scanPortalById } from "@/lib/scanner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const id = typeof body?.id === "string" ? body.id : "";
  if (!id || id.length > 80) {
    return NextResponse.json({ error: "A valid portal id is required" }, { status: 400 });
  }

  try {
    const observation = await scanPortalById(id, false);
    return NextResponse.json({ observation }, { headers: { "Cache-Control": "no-store" } });
  } catch (error: any) {
    const status = error?.message === "Unknown portal ID" ? 404 : 500;
    return NextResponse.json({ error: error?.message || "Scan failed" }, { status });
  }
}
