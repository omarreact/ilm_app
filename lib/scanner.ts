import dns from "node:dns/promises";
import net from "node:net";
import crypto from "node:crypto";
import * as cheerio from "cheerio";
import { HOST_ALLOWLIST, PORTAL_BY_ID } from "./registry";
import { getLatestObservation, saveObservation } from "./db";
import type { Observation, Portal } from "./types";

const timeoutMs = Number(process.env.SCAN_TIMEOUT_MS || 12000);
const maxBytes = Number(process.env.SCAN_MAX_BYTES || 1500000);
const maxRedirects = Number(process.env.SCAN_MAX_REDIRECTS || 5);
const minInterval = Number(process.env.SCAN_MIN_INTERVAL_SECONDS || 900);

const SERVICE_PATTERNS: Array<[string, RegExp]> = [
  ["NID", /national identity|\bnid\b|জাতীয় পরিচয়|এন.?আই.?ডি/i],
  ["Birth registration", /birth registration|জন্ম নিবন্ধন|জন্ম সনদ/i],
  ["Land / Porcha", /porcha|khatian|খতিয়ান|খতিয়ান|দাগ|land record|ভূমি/i],
  ["Trade licence", /trade licen[cs]e|ট্রেড লাইসেন্স/i],
  ["Certificates", /certificate|সনদ|warish|ওয়ারিশ|উত্তরাধিকার|citizenship|character/i],
  ["TIN / Tax", /\btin\b|income tax|কর|holding tax|হোল্ডিং/i],
  ["MFS / mobile banking", /bkash|nagad|rocket|mobile banking/i],
  ["Call / CDR", /call detail|cdr|call list/i],
  ["Location", /live location|last known location|location track|radio.location/i],
  ["SIM / IMEI", /sim ownership|imei/i],
  ["SMS", /bulk sms|location sms|\bsms\b/i],
  ["Passport / Travel", /passport|visa|bmet/i],
  ["Vehicle / Driving", /driving licen[cs]e|vehicle|brta/i],
  ["OCR", /\bocr\b/i],
  ["Payments", /payment|pay now|পেমেন্ট|recharge|রিচার্জ/i]
];

const HIGH_RISK_PATTERNS: Array<[string, RegExp]> = [
  ["CDR / call-list claim", /call\s*detail|\bcdr\b|call\s*list/i],
  ["SIM ownership claim", /sim\s*ownership|sim\s*owner/i],
  ["IMEI lookup claim", /\bimei\b/i],
  ["Location-data claim", /last\s*known\s*location|live\s*location|radio[-\s]*location|location\s*track/i],
  ["Mobile-banking data claim", /mobile\s*banking\s*(info|record|log|transaction)/i],
  ["Phone-to-NID claim", /number\s*to\s*nid|phone\s*to\s*nid|nid\s*by\s*number/i]
];

function isBlockedIp(ip: string): boolean {
  if (net.isIP(ip) === 4) {
    const parts = ip.split(".").map(Number);
    const [a, b] = parts;
    return (
      a === 0 || a === 10 || a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      a >= 224
    );
  }
  const x = ip.toLowerCase();
  return (
    x === "::1" || x === "::" ||
    x.startsWith("fc") || x.startsWith("fd") ||
    x.startsWith("fe8") || x.startsWith("fe9") ||
    x.startsWith("fea") || x.startsWith("feb")
  );
}

async function validateUrl(rawUrl: string): Promise<URL> {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:") throw new Error("Only HTTPS targets are allowed");
  const host = url.hostname.toLowerCase();
  if (!HOST_ALLOWLIST.has(host)) throw new Error("Hostname is not allowlisted");

  const records = await dns.lookup(host, { all: true, verbatim: true });
  if (!records.length) throw new Error("DNS did not return an address");
  if (records.some((r) => isBlockedIp(r.address))) {
    throw new Error("Target resolves to a private/reserved address");
  }
  return url;
}

function sanitiseText(value: string | null | undefined, limit = 500): string | null {
  if (!value) return null;
  const clean = value
    .replace(/(?:\+?88)?(01[3-9]\d{2})(\d{3})(\d{4})/g, "$1•••$3")
    .replace(/\b(\d{3})(\d{5,11})(\d{3})\b/g, "$1••••••$3")
    .replace(/\s+/g, " ")
    .trim();
  return clean.slice(0, limit) || null;
}

async function readTextLimited(response: Response): Promise<string> {
  const length = Number(response.headers.get("content-length") || 0);
  if (length && length > maxBytes) throw new Error("Response exceeds configured size limit");

  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let out = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error("Response exceeded configured size limit");
    }
    out += decoder.decode(value, { stream: true });
  }
  out += decoder.decode();
  return out;
}

function extractSignals(text: string) {
  const $ = cheerio.load(text);
  $("script,style,noscript,template,svg").remove();

  const title = sanitiseText($("title").first().text(), 250);
  const metaDescription = sanitiseText($('meta[name="description"]').first().attr("content"), 500);
  const visible = $("body").text().replace(/\s+/g, " ").trim().slice(0, 300000);

  const services = SERVICE_PATTERNS.filter(([, rx]) => rx.test(visible)).map(([name]) => name);
  const channels = $("a[href]")
    .map((_, el) => $(el).attr("href"))
    .get()
    .filter((href): href is string => Boolean(href))
    .filter((href) => /(?:wa\.me|whatsapp\.com|t\.me|telegram\.me)/i.test(href))
    .slice(0, 30)
    .map((href) => sanitiseText(href, 500)!)
    .filter(Boolean);

  const payments = ["bKash", "Nagad", "Rocket", "Surjopay", "Upay", "bank"].filter((x) => new RegExp(x, "i").test(visible));
  const highRiskHits = HIGH_RISK_PATTERNS.filter(([, rx]) => rx.test(visible)).map(([name]) => name);
  const loginDetected = /\blog\s*in\b|\blogin\b|লগইন|প্রবেশ করুন/i.test(visible) || $('input[type="password"]').length > 0;
  const registerDetected = /register|registration|sign\s*up|নিবন্ধন|রেজিস্ট্রেশন/i.test(visible);

  return { title, metaDescription, services, channels, payments, highRiskHits, loginDetected, registerDetected };
}

function makeHash(input: unknown) {
  return crypto.createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

async function fetchPublic(start: string) {
  let current = await validateUrl(start);
  const started = Date.now();

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(current, {
        method: "GET",
        redirect: "manual",
        cache: "no-store",
        credentials: "omit",
        signal: controller.signal,
        headers: {
          "accept": "text/html,application/xhtml+xml,text/plain;q=0.8,*/*;q=0.2",
          "user-agent": "DigitalSebaPublicMonitor/1.0 (+passive-public-research)"
        }
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) return { response, finalUrl: current.toString(), text: "", latencyMs: Date.now() - started };
        if (hop === maxRedirects) throw new Error("Too many redirects");
        current = await validateUrl(new URL(location, current).toString());
        continue;
      }

      const contentType = response.headers.get("content-type") || "";
      const text = /html|text|json|xml/i.test(contentType) ? await readTextLimited(response) : "";
      return { response, finalUrl: current.toString(), text, latencyMs: Date.now() - started };
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error("Redirect loop");
}

export async function scanPortal(portal: Portal, force = false): Promise<Observation> {
  if (!portal.url) {
    const obs: Observation = {
      portalId: portal.id,
      checkedAt: new Date().toISOString(),
      category: "unresolved",
      status: null,
      finalUrl: null,
      title: null,
      metaDescription: null,
      services: [],
      channels: [],
      payments: [],
      loginDetected: null,
      registerDetected: null,
      highRiskHits: [],
      contentHash: null,
      changed: false,
      latencyMs: null,
      error: "Exact hostname is not available; scanner does not guess."
    };
    return saveObservation(obs);
  }

  const previous = await getLatestObservation(portal.id);
  if (!force && previous) {
    const ageSec = (Date.now() - new Date(previous.checkedAt).getTime()) / 1000;
    if (ageSec < minInterval) return previous;
  }

  const checkedAt = new Date().toISOString();

  try {
    const { response, finalUrl, text, latencyMs } = await fetchPublic(portal.url);
    const signals = text ? extractSignals(text) : {
      title: null, metaDescription: null, services: [], channels: [], payments: [],
      highRiskHits: [], loginDetected: null, registerDetected: null
    };
    const contentHash = makeHash({ finalUrl, status: response.status, ...signals });
    const changed = Boolean(previous?.contentHash && previous.contentHash !== contentHash);

    return saveObservation({
      portalId: portal.id,
      checkedAt,
      category: response.ok ? "live" : "http_error",
      status: response.status,
      finalUrl,
      title: signals.title,
      metaDescription: signals.metaDescription,
      services: signals.services,
      channels: signals.channels,
      payments: signals.payments,
      loginDetected: signals.loginDetected,
      registerDetected: signals.registerDetected,
      highRiskHits: signals.highRiskHits,
      contentHash,
      changed,
      latencyMs,
      error: response.ok ? null : `HTTP ${response.status}`
    });
  } catch (error: any) {
    const timeout = error?.name === "AbortError";
    return saveObservation({
      portalId: portal.id,
      checkedAt,
      category: timeout ? "timeout" : "network_error",
      status: null,
      finalUrl: portal.url,
      title: null,
      metaDescription: null,
      services: [],
      channels: [],
      payments: [],
      loginDetected: null,
      registerDetected: null,
      highRiskHits: [],
      contentHash: null,
      changed: false,
      latencyMs: null,
      error: sanitiseText(error?.message || String(error), 500)
    });
  }
}

export async function scanPortalById(id: string, force = false) {
  const portal = PORTAL_BY_ID.get(id);
  if (!portal) throw new Error("Unknown portal ID");
  return scanPortal(portal, force);
}
