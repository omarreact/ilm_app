const DEFAULT_PORICHOY_BASE_URL = "https://api.porichoybd.com";
const DEFAULT_NID_PATH = "/api/v2/verifications/autofill";
const DEFAULT_BIRTH_PATH = "/api/v1/verifications/autofill";

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

function envValue(name: string, fallback: string) {
  const value = process.env[name]?.trim();
  return value || fallback;
}

function porichoyBaseUrl() {
  const raw = envValue("PORICHOY_BASE_URL", DEFAULT_PORICHOY_BASE_URL).replace(/\/+$/, "");
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new PorichoyError("Verification provider URL is invalid.", 503, "PORICHOY_BAD_CONFIG");
  }

  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new PorichoyError("Verification provider must use HTTPS.", 503, "PORICHOY_BAD_CONFIG");
  }

  return url.toString().replace(/\/$/, "");
}

function porichoyPath(name: "PORICHOY_NID_PATH" | "PORICHOY_BIRTH_PATH", fallback: string) {
  const value = envValue(name, fallback);
  return value.startsWith("/") ? value : `/${value}`;
}

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

const OMIT_KEY = /(photo|image|signature|finger|phone|mobile|email|address|token|api.?key|secret|password|face|biometric|blood|spouse|parent|voter|permanent|present)/i;
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

function safeNetworkCode(error: unknown) {
  if (!(error instanceof Error)) return "UNKNOWN";
  const cause = (error as Error & { cause?: unknown }).cause;
  if (cause && typeof cause === "object") {
    const code = (cause as { code?: unknown }).code;
    if (typeof code === "string" && /^[A-Z0-9_]+$/.test(code)) return code;
  }
  return error.name || "ERROR";
}

export async function probePorichoyProvider() {
  const baseUrl = porichoyBaseUrl();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(baseUrl, {
      method: "HEAD",
      cache: "no-store",
      redirect: "manual",
      signal: controller.signal
    });

    return {
      reachable: true,
      status: response.status,
      state: response.status >= 500 ? "degraded" : "reachable"
    } as const;
  } catch (error: unknown) {
    return {
      reachable: false,
      status: null,
      state: "unreachable",
      reason: safeNetworkCode(error)
    } as const;
  } finally {
    clearTimeout(timer);
  }
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

  const baseUrl = porichoyBaseUrl();
  const timeoutMs = Math.max(3000, Number(process.env.PORICHOY_TIMEOUT_MS || 15000));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl}${path}`, {
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
      if (response.status >= 500) {
        throw new PorichoyError(
          "Porichoy is temporarily unavailable. Please try again later.",
          503,
          "PORICHOY_UPSTREAM_UNAVAILABLE"
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

    const code = safeNetworkCode(error);
    console.error("[porichoy] upstream connection failed", {
      host: new URL(baseUrl).host,
      code
    });

    throw new PorichoyError(
      "Porichoy verification service cannot be reached right now. Please try again later.",
      503,
      `PORICHOY_NETWORK_${code}`
    );
  } finally {
    clearTimeout(timer);
  }
}

export function verifyNid(nidNumber: string, dateOfBirth: string) {
  const path = porichoyPath("PORICHOY_NID_PATH", DEFAULT_NID_PATH);

  if (path.includes("/basic-nid")) {
    return porichoyRequest(path, {
      national_id: nidNumber,
      person_dob: dateOfBirth,
      team_tx_id: crypto.randomUUID(),
      match_name: false
    });
  }

  return porichoyRequest(path, {
    nidNumber,
    dateOfBirth,
    englishTranslation: true
  });
}

export function verifyBirthRegistration(birthRegistrationNumber: string, dateOfBirth: string) {
  const path = porichoyPath("PORICHOY_BIRTH_PATH", DEFAULT_BIRTH_PATH);
  return porichoyRequest(path, {
    birthRegistrationNumber,
    dateOfBirth
  });
}
