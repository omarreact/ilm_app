import { NextResponse } from "next/server";
import { healthCheck } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const database = await healthCheck();
    return NextResponse.json({
      ok: true,
      database,
      mode: database ? "persistent" : "stateless",
      time: new Date().toISOString()
    });
  } catch (error: any) {
    return NextResponse.json({
      ok: true,
      database: false,
      mode: "stateless",
      time: new Date().toISOString(),
      warning: error?.message || String(error)
    });
  }
}
