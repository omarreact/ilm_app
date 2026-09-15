const PORICHOY_BASE_URL = "https://api.porichoybd.com";

export class PorichoyError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 502, code = "PORICHOY_ERROR") {
    super(message);
    this.name = "PorichoyError";
    this.status = status;
    this.code = code;
  }
}

type RateEntry = { count: number; resetAt: number };
const rateBuckets = new Map<string, RateEntry>();

export function porichoyConfigured() {
  return Boolean(process.env.PORICHOY_API_KEY?.trim());
}

export function maskIdentifier(value: string) {
  const clean = value.replace(/\s+/g, "");
  if (clean.length <= 4) return "••••";
  return `${"•".repeat(Math.max(4, clean.length - 4))}${clean.slice(-4)}`;
}

export function checkRateLimit(key: string) {
  const now = Date.now();
  const limit = Math.max(1, Number(process.env.VERIFY_RATE_LIMIT || 6));
  const windowMs = Math.max(10_000, Number(process.env.VERIFY_RATE_WINDOW_MS || 300_000));

  if (rateBuckets.size > 5000) {
    for (const [bucketKey, entry] of rateBuckets) {
      if (entry.resetAt <= now) rateBuckets.delete(bucketKey);
    }
  }

  const existing = rateBuckets.get(key);
  if (!existing || existing.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000))
    };
  }

  existing.count += 1;
  rateBuckets.set(key, existing);
  return { allowed: true, remaining: Math.max(0, limit - existing.count), retryAfterSeconds: 0 };
}

const OMIT_KEY = /(photo|image|signature|finger|phone|mobile|email|address|token|api.?key|secret|password|face|biometric)/i;
const IDENTIFIER_KEY = /(nid|national.?id|birth.?registration|birth.?reg|brn)/i;

function sanitize(value: unknown, key = "", depth = 0): unknown {
  if (depth > 5) return undefined;
  if (value === null || value === undefined) return value;

  if (key && OMIT_KEY.test(key)) return undefined;

  if (typeof value === "string") {
    const trimmed = value.length > 500 ? `${value.slice(0, 500)}…` : value;
    const digits = trimmed.replace(/\D/g, "");
    if (IDENTIFIER_KEY.test(key) && digits.length >= 8 && digits.length <= 20) {
      return maskIdentifier(trimmed);
    }
    return trimmed;
  }

  if (typeof value === "number" || typeof value === "boolean") return value;

  if (Array.isArray(value)) {
    return value
      .slice(0, 25)
      .map((item) => sanitize(item, key, depth + 1))
      .filter((item) => item !== undefined);
  }

  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [childKey, childValue] of Object.entries(value as Record<string, unknown>)) {
      const cleaned = sanitize(childValue, childKey, depth + 1);
      if (cleaned !== undefined) out[childKey] = cleaned;
    }
    return out;
  }

  return undefined;
}

async function porichoyRequest(path: string, payload: Record<string, unknown>) {
  const apiKey = process.env.PORICHOY_API_KEY?.trim();
  if (!apiKey) {
    throw new PorichoyError(
      "Porichoy production API key is not configured on the server.",
      503,
      "PORICHOY_NOT_CONFIGURED"
    );
  }

  const timeoutMs = Math.max(3000, Number(process.env.PORICHOY_TIMEOUT_MS || 15000));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${PORICHOY_BASE_URL}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "x-api-key": apiKey
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: controller.signal
    });

    const text = await response.text();
    let body: unknown = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = { message: text.slice(0, 500) };
      }
    }

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new PorichoyError(
          "Porichoy rejected the configured credential. Check production access and API key.",
          502,
          "PORICHOY_AUTH_FAILED"
        );
      }
      if (response.status === 404) {
        throw new PorichoyError(
          "No matching record was returned by the verification provider.",
          404,
          "RECORD_NOT_FOUND"
        );
      }
      if (response.status === 429) {
        throw new PorichoyError(
          "Verification provider rate limit reached. Please try again later.",
          429,
          "UPSTREAM_RATE_LIMIT"
        );
      }
      throw new PorichoyError(
        `Verification provider returned HTTP ${response.status}.`,
        502,
        "PORICHOY_UPSTREAM_ERROR"
      );
    }

    return sanitize(body);
  } catch (error: unknown) {
    if (error instanceof PorichoyError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new PorichoyError("Verification provider timed out.", 504, "PORICHOY_TIMEOUT");
    }
    throw new PorichoyError("Could not reach the verification provider.", 502, "PORICHOY_NETWORK_ERROR");
  } finally {
    clearTimeout(timer);
  }
}

export function verifyNid(nidNumber: string, dateOfBirth: string) {
  return porichoyRequest("/api/v2/verifications/autofill", {
    nidNumber,
    dateOfBirth,
    englishTranslation: true
  });
}

export function verifyBirthRegistration(birthRegistrationNumber: string, dateOfBirth: string) {
  return porichoyRequest("/api/v1/verifications/autofill", {
    birthRegistrationNumber,
    dateOfBirth
  });
}
