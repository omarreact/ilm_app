import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, maskIdentifier, PorichoyError, verifyBirthRegistration } from "@/lib/porichoy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BRN_PATTERN = /^\d{17}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function clientKey(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown";
}

function noStore(body: unknown, init?: { status?: number; headers?: Record<string, string> }) {
  return NextResponse.json(body, {
    status: init?.status ?? 200,
    headers: {
      "cache-control": "no-store, max-age=0",
      pragma: "no-cache",
      ...(init?.headers || {})
    }
  });
}

export async function POST(request: NextRequest) {
  const rate = checkRateLimit(`birth:${clientKey(request)}`);
  if (!rate.allowed) {
    return noStore(
      { ok: false, error: "Too many verification attempts. Please try again later." },
      { status: 429, headers: { "retry-after": String(rate.retryAfterSeconds) } }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return noStore({ ok: false, error: "Invalid JSON request." }, { status: 400 });
  }

  const birthRegistrationNumber = String(body.birthRegistrationNumber || "").trim();
  const dateOfBirth = String(body.dateOfBirth || "").trim();
  const consent = body.consent === true;

  if (!consent) {
    return noStore({ ok: false, error: "Lawful authorization or consent is required." }, { status: 400 });
  }
  if (!BRN_PATTERN.test(birthRegistrationNumber)) {
    return noStore({ ok: false, error: "Birth Registration Number must be exactly 17 digits." }, { status: 400 });
  }
  if (!DATE_PATTERN.test(dateOfBirth) || Number.isNaN(Date.parse(`${dateOfBirth}T00:00:00Z`))) {
    return noStore({ ok: false, error: "Date of birth must be a valid YYYY-MM-DD date." }, { status: 400 });
  }

  try {
    const result = await verifyBirthRegistration(birthRegistrationNumber, dateOfBirth);
    return noStore({
      ok: true,
      type: "birth",
      maskedIdentifier: maskIdentifier(birthRegistrationNumber),
      source: "Porichoy authorized verification API",
      checkedAt: new Date().toISOString(),
      result
    });
  } catch (error: unknown) {
    if (error instanceof PorichoyError) {
      return noStore({ ok: false, code: error.code, error: error.message }, { status: error.status });
    }
    return noStore({ ok: false, error: "Unexpected verification error." }, { status: 500 });
  }
}
