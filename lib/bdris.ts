/**
 * Official BDRIS birth verification client
 * Source of truth: https://everify.bdris.gov.bd/
 *
 * Flow:
 * 1. GET form page -> extract __RequestVerificationToken
 * 2. GET CAPTCHA image -> return base64 + session token
 * 3. User solves CAPTCHA
 * 4. POST multipart form with UBRN, DOB, CAPTCHA answer, CSRF token
 * 5. Parse HTML result table into JSON
 */

const BDRIS_BASE = process.env.BDRIS_BASE_URL?.replace(/\/+$/, "") || "https://everify.bdris.gov.bd";
const FORM_PATH = "/UBRNVerification/Search";
const CAPTCHA_PATH = "/DefaultCaptcha/Generate";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export class BdrisError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 502, code = "BDRIS_ERROR") {
    super(message);
    this.name = "BdrisError";
    this.status = status;
    this.code = code;
  }
}

type SessionEntry = {
  csrf: string;
  captchaId: string;
  cookies: string;
  createdAt: number;
};

const sessions = new Map<string, SessionEntry>();
const SESSION_TTL_MS = 5 * 60 * 1000;

function pruneSessions() {
  const now = Date.now();
  if (sessions.size < 200) return;
  for (const [id, entry] of sessions) {
    if (now - entry.createdAt > SESSION_TTL_MS) sessions.delete(id);
  }
}

function extractCookies(response: Response): string {
  const anyHeaders = response.headers as Headers & { getSetCookie?: () => string[] };
  if (typeof anyHeaders.getSetCookie === "function") {
    return anyHeaders
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .filter(Boolean)
      .join("; ");
  }
  const raw = response.headers.get("set-cookie");
  if (!raw) return "";
  return raw
    .split(/,(?=\s*[^;=]+=)/)
    .map((c) => c.split(";")[0].trim())
    .filter(Boolean)
    .join("; ");
}

function mergeCookies(existing: string, incoming: string): string {
  const map = new Map<string, string>();
  for (const part of `${existing}; ${incoming}`.split(";")) {
    const trimmed = part.trim();
    if (!trimmed || !trimmed.includes("=")) continue;
    const eq = trimmed.indexOf("=");
    const name = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (name) map.set(name, value);
  }
  return Array.from(map.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

function extractCsrf(html: string): string | null {
  const patterns = [
    /name=["']__RequestVerificationToken["'][^>]*value=["']([^"']+)["']/i,
    /value=["']([^"']+)["'][^>]*name=["']__RequestVerificationToken["']/i,
    /name="__RequestVerificationToken"\s+type="hidden"\s+value="([^"]+)"/i
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return m[1];
  }
  return null;
}

function randomId(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

export type CaptchaPayload = {
  sessionId: string;
  captchaImage: string;
  expiresInSeconds: number;
};

export async function createBdrisCaptchaSession(): Promise<CaptchaPayload> {
  pruneSessions();

  const timeoutMs = Math.max(5000, Number(process.env.BDRIS_TIMEOUT_MS || 20000));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const formRes = await fetch(`${BDRIS_BASE}${FORM_PATH}`, {
      method: "GET",
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-BD,en;q=0.9,bn;q=0.8"
      },
      cache: "no-store",
      redirect: "follow",
      signal: controller.signal
    });

    if (!formRes.ok) {
      throw new BdrisError(
        `BDRIS form page returned HTTP ${formRes.status}.`,
        503,
        "BDRIS_FORM_UNAVAILABLE"
      );
    }

    let formHtml = await formRes.text();
    let cookies = extractCookies(formRes);
    let csrf = extractCsrf(formHtml);

    if (!csrf) {
      const rootRes = await fetch(`${BDRIS_BASE}/`, {
        method: "GET",
        headers: {
          "User-Agent": UA,
          Accept: "text/html,application/xhtml+xml",
          Cookie: cookies || ""
        },
        cache: "no-store",
        signal: controller.signal
      });
      formHtml = await rootRes.text();
      cookies = mergeCookies(cookies, extractCookies(rootRes));
      csrf = extractCsrf(formHtml);
    }

    if (!csrf) {
      throw new BdrisError("Could not extract CSRF token from BDRIS form.", 502, "BDRIS_CSRF_MISSING");
    }

    const captchaId = randomId();
    const captchaRes = await fetch(`${BDRIS_BASE}${CAPTCHA_PATH}?t=${captchaId}`, {
      method: "GET",
      headers: {
        "User-Agent": UA,
        Accept: "image/png,image/*;q=0.8,*/*;q=0.5",
        Referer: `${BDRIS_BASE}/`,
        Cookie: cookies || ""
      },
      cache: "no-store",
      signal: controller.signal
    });

    if (!captchaRes.ok) {
      throw new BdrisError("Failed to fetch CAPTCHA image from BDRIS.", 503, "BDRIS_CAPTCHA_FAILED");
    }

    cookies = mergeCookies(cookies, extractCookies(captchaRes));
    const buf = Buffer.from(await captchaRes.arrayBuffer());
    const sessionId = randomId();

    sessions.set(sessionId, {
      csrf,
      captchaId,
      cookies,
      createdAt: Date.now()
    });

    return {
      sessionId,
      captchaImage: `data:image/png;base64,${buf.toString("base64")}`,
      expiresInSeconds: Math.floor(SESSION_TTL_MS / 1000)
    };
  } catch (error: unknown) {
    if (error instanceof BdrisError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new BdrisError("BDRIS request timed out.", 504, "BDRIS_TIMEOUT");
    }
    throw new BdrisError(
      "BDRIS verification service cannot be reached right now.",
      503,
      "BDRIS_NETWORK_ERROR"
    );
  } finally {
    clearTimeout(timer);
  }
}

export type BdrisVerifyResult = {
  status: "success" | "not_found";
  message: string;
  data: Record<string, string> | null;
  source: string;
};

export async function verifyBirthWithBdris(
  ubrn: string,
  dob: string,
  captchaAnswer: string,
  sessionId: string
): Promise<BdrisVerifyResult> {
  const session = sessions.get(sessionId);
  if (!session || Date.now() - session.createdAt > SESSION_TTL_MS) {
    sessions.delete(sessionId);
    throw new BdrisError(
      "CAPTCHA session expired. Please refresh the CAPTCHA and try again.",
      400,
      "CAPTCHA_SESSION_EXPIRED"
    );
  }

  sessions.delete(sessionId);

  const timeoutMs = Math.max(5000, Number(process.env.BDRIS_TIMEOUT_MS || 20000));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const boundary = `----WebKitFormBoundary${randomId().slice(0, 16)}`;
    const parts: string[] = [];

    const fields: Record<string, string> = {
      __RequestVerificationToken: session.csrf,
      UBRN: ubrn,
      BirthDate: dob,
      CaptchaDeText: session.captchaId,
      CaptchaInputText: captchaAnswer.trim()
    };

    for (const [name, value] of Object.entries(fields)) {
      parts.push(
        `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`
      );
    }
    parts.push(`--${boundary}--\r\n`);
    const body = parts.join("");

    const response = await fetch(`${BDRIS_BASE}${FORM_PATH}`, {
      method: "POST",
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        Origin: BDRIS_BASE,
        Referer: `${BDRIS_BASE}${FORM_PATH}`,
        Cookie: session.cookies || ""
      },
      body,
      cache: "no-store",
      redirect: "follow",
      signal: controller.signal
    });

    const html = await response.text();
    const lower = html.toLowerCase();

    if (
      lower.includes("captcha") &&
      (lower.includes("invalid") || lower.includes("incorrect") || lower.includes("wrong"))
    ) {
      throw new BdrisError("CAPTCHA answer is incorrect. Please try again.", 400, "CAPTCHA_INVALID");
    }

    if (!response.ok) {
      throw new BdrisError(`BDRIS returned HTTP ${response.status}.`, 502, "BDRIS_UPSTREAM_ERROR");
    }

    return parseBdrisHtml(html, ubrn, dob);
  } catch (error: unknown) {
    if (error instanceof BdrisError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new BdrisError("BDRIS request timed out.", 504, "BDRIS_TIMEOUT");
    }
    throw new BdrisError(
      "BDRIS verification service cannot be reached right now.",
      503,
      "BDRIS_NETWORK_ERROR"
    );
  } finally {
    clearTimeout(timer);
  }
}

function parseBdrisHtml(html: string, ubrn: string, dob: string): BdrisVerifyResult {
  const lower = html.toLowerCase();

  if (
    lower.includes("no record") ||
    lower.includes("not found") ||
    lower.includes("no result")
  ) {
    return {
      status: "not_found",
      message: "Birth certificate record not found for the given UBRN and date of birth.",
      data: null,
      source: "everify.bdris.gov.bd"
    };
  }

  const data: Record<string, string> = {};
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowRe.exec(html)) !== null) {
    const cells: string[] = [];
    const cellRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRe.exec(rowMatch[1])) !== null) {
      const text = cellMatch[1]
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (text) cells.push(text);
    }

    if (cells.length >= 2) {
      const label = cells[0].toLowerCase();
      const value = cells[1];

      if (/name|nam/.test(label) && !/father|mother|pita|mata/.test(label)) {
        data.name = value;
      } else if (/father|pita/.test(label)) {
        data.father_name = value;
      } else if (/mother|mata/.test(label)) {
        data.mother_name = value;
      } else if (/birth.*date|date.*birth|janma.*tarikh|tarikh.*janma/.test(label)) {
        data.date_of_birth = value;
      } else if (/registration.*number|ubrn|brn/.test(label)) {
        data.registration_number = value;
      } else if (/registration.*date/.test(label)) {
        data.registration_date = value;
      } else if (/union/.test(label)) {
        data.union = value;
      } else if (/district/.test(label)) {
        data.district = value;
      } else if (/sex|gender/.test(label)) {
        data.gender = value;
      } else if (/place.*birth/.test(label)) {
        data.place_of_birth = value;
      }
    }
  }

  if (Object.keys(data).length === 0) {
    if (lower.includes("birth registration number") && lower.includes("captcha")) {
      return {
        status: "not_found",
        message: "Birth certificate record not found for the given UBRN and date of birth.",
        data: null,
        source: "everify.bdris.gov.bd"
      };
    }

    throw new BdrisError(
      "Unable to parse BDRIS verification response. The portal layout may have changed.",
      502,
      "BDRIS_PARSE_ERROR"
    );
  }

  if (!data.registration_number) data.registration_number = ubrn;
  if (!data.date_of_birth) data.date_of_birth = dob;

  return {
    status: "success",
    message: "Birth certificate verified successfully against official BDRIS records.",
    data,
    source: "everify.bdris.gov.bd"
  };
}

export function bdrisConfigured() {
  return true;
}
