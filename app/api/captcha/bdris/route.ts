import { NextResponse } from "next/server";
import { BdrisError, createBdrisCaptchaSession } from "@/lib/bdris";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function noStore(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "cache-control": "no-store, max-age=0",
      pragma: "no-cache"
    }
  });
}

/**
 * GET /api/captcha/bdris
 * Returns a CAPTCHA image + short-lived sessionId for official BDRIS verification.
 */
export async function GET() {
  try {
    const captcha = await createBdrisCaptchaSession();
    return noStore({
      ok: true,
      sessionId: captcha.sessionId,
      captchaImage: captcha.captchaImage,
      expiresInSeconds: captcha.expiresInSeconds,
      source: "everify.bdris.gov.bd"
    });
  } catch (error: unknown) {
    if (error instanceof BdrisError) {
      return noStore({ ok: false, code: error.code, error: error.message }, error.status);
    }
    return noStore({ ok: false, error: "Failed to generate CAPTCHA." }, 500);
  }
}
