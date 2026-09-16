"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Kind = "nid" | "birth";

type Health = {
  ok: boolean;
  porichoyConfigured: boolean;
  mode: "ready" | "setup-required";
  providerNetwork?: {
    reachable: boolean;
    status: number | null;
    state: "reachable" | "degraded" | "unreachable";
    reason?: string;
  };
};

type VerificationResponse = {
  ok: boolean;
  type: Kind;
  maskedIdentifier: string;
  source: string;
  checkedAt: string;
  result: unknown;
};

const OFFICIAL_NID = "https://services.nidw.gov.bd/nid-pub/";
const OFFICIAL_BIRTH = "https://everify.bdris.gov.bd/";

function labelFor(key: string) {
  const map: Record<string, string> = {
    name: "নাম",
    nameBangla: "নাম (বাংলা)",
    nameEnglish: "নাম (ইংরেজি)",
    fullName: "পূর্ণ নাম",
    dateOfBirth: "জন্ম তারিখ",
    dob: "জন্ম তারিখ",
    gender: "লিঙ্গ",
    fatherName: "পিতার নাম",
    motherName: "মাতার নাম",
    spouseName: "স্বামী/স্ত্রীর নাম",
    nationality: "জাতীয়তা",
    status: "স্ট্যাটাস",
    verified: "যাচাইকৃত",
    message: "বার্তা"
  };
  if (map[key]) return map[key];
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/^./, (s) => s.toUpperCase());
}

function flatten(value: unknown, prefix = ""): Array<[string, string]> {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => flatten(item, `${prefix}${prefix ? "." : ""}${index + 1}`));
  }
  if (typeof value !== "object") return [[prefix || "value", String(value)]];

  return Object.entries(value as Record<string, unknown>).flatMap(([key, val]) => {
    const next = prefix ? `${prefix}.${key}` : key;
    if (val !== null && typeof val === "object") return flatten(val, next);
    return [[next, val === null || val === undefined ? "—" : String(val)] as [string, string]];
  });
}

export default function Home() {
  const [kind, setKind] = useState<Kind>("nid");
  const [nid, setNid] = useState("");
  const [brn, setBrn] = useState("");
  const [dob, setDob] = useState("");
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [response, setResponse] = useState<VerificationResponse | null>(null);
  const [health, setHealth] = useState<Health | null>(null);

  useEffect(() => {
    let active = true;

    async function refreshHealth() {
      try {
        const res = await fetch("/api/health", { cache: "no-store" });
        const json = await res.json();
        if (active) setHealth(json);
      } catch {
        if (active) setHealth(null);
      }
    }

    void refreshHealth();
    const timer = window.setInterval(() => void refreshHealth(), 30_000);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void refreshHealth();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  useEffect(() => {
    setError("");
    setResponse(null);
    setConsent(false);
  }, [kind]);

  const rows = useMemo(() => (response ? flatten(response.result) : []), [response]);
  const configured = health?.porichoyConfigured === true;
  const providerReachable = health?.providerNetwork?.reachable === true;
  const ready = configured && providerReachable;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setResponse(null);

    if (!ready) {
      setError("Porichoy verification service এখন পাওয়া যাচ্ছে না। কিছুক্ষণ পরে আবার চেষ্টা করুন।");
      return;
    }

    if (!consent) {
      setError("যাচাই করার আইনগত অনুমতি/সম্মতি নিশ্চিত করুন।");
      return;
    }

    setLoading(true);
    try {
      const body = kind === "nid"
        ? { nidNumber: nid.trim(), dateOfBirth: dob, consent: true }
        : { birthRegistrationNumber: brn.trim(), dateOfBirth: dob, consent: true };

      const res = await fetch(`/api/verify/${kind}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(body)
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || json.message || "Verification failed");
      setResponse(json);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  }

  const apiStatusText = health === null
    ? "Checking API…"
    : !configured
      ? "API key required"
      : providerReachable
        ? "Official API ready"
        : "Provider temporarily unavailable";

  return (
    <main className="shell">
      <header className="hero">
        <div className="brandRow">
          <div className="mark" aria-hidden="true">✓</div>
          <div>
            <div className="eyebrow">BANGLADESH IDENTITY VERIFICATION</div>
            <h1>বাংলাদেশ পরিচয় যাচাই</h1>
          </div>
          <span className={`statusPill ${ready ? "ready" : "setup"}`}>
            {apiStatusText}
          </span>
        </div>
        <p className="heroText">
          অনুমোদিত Porichoy integration দিয়ে জাতীয় পরিচয়পত্র ও জন্ম নিবন্ধন তথ্য যাচাই করুন।
          আপনার দেওয়া পরিচয় তথ্য এই অ্যাপ database-এ সংরক্ষণ করা হয় না।
        </p>
      </header>

      <section className="grid">
        <div className="card verifyCard">
          <div className="tabs" role="tablist" aria-label="Verification type">
            <button className={kind === "nid" ? "tab active" : "tab"} onClick={() => setKind("nid")} type="button">
              জাতীয় পরিচয়পত্র
              <small>NID Verification</small>
            </button>
            <button className={kind === "birth" ? "tab active" : "tab"} onClick={() => setKind("birth")} type="button">
              জন্ম নিবন্ধন
              <small>Birth Certificate</small>
            </button>
          </div>

          <form onSubmit={submit} className="form">
            {kind === "nid" ? (
              <label>
                <span>জাতীয় পরিচয়পত্র নম্বর</span>
                <input
                  value={nid}
                  onChange={(e) => setNid(e.target.value.replace(/\D/g, "").slice(0, 17))}
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="10 / 13 / 17 digit NID"
                  minLength={10}
                  maxLength={17}
                  required
                />
                <small>শুধু নিজের বা যাচাই করার বৈধ অনুমতি আছে এমন NID ব্যবহার করুন।</small>
              </label>
            ) : (
              <label>
                <span>জন্ম নিবন্ধন নম্বর</span>
                <input
                  value={brn}
                  onChange={(e) => setBrn(e.target.value.replace(/\D/g, "").slice(0, 17))}
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="17 digit Birth Registration Number"
                  minLength={17}
                  maxLength={17}
                  required
                />
                <small>BDRIS জন্ম নিবন্ধন নম্বর ১৭ অংকের হতে হবে।</small>
              </label>
            )}

            <label>
              <span>জন্ম তারিখ</span>
              <input value={dob} onChange={(e) => setDob(e.target.value)} type="date" required />
              <small>সরকারি রেকর্ডে থাকা জন্ম তারিখ দিন।</small>
            </label>

            <label className="consent">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>আমি নিশ্চিত করছি যে এই পরিচয় তথ্য যাচাই করার বৈধ অনুমতি বা সংশ্লিষ্ট ব্যক্তির সম্মতি আমার আছে।</span>
            </label>

            {error && <div className="errorBox" role="alert">{error}</div>}

            {!configured && health && (
              <div className="setupBox">
                <strong>Porichoy production credential এখনো configured নয়।</strong>
                <span>Vercel-এ <code>PORICHOY_API_KEY</code> যোগ করলে এই form real verification করবে।</span>
              </div>
            )}

            {configured && health && !providerReachable && (
              <div className="setupBox" role="status">
                <strong>Porichoy provider এখন network থেকে পাওয়া যাচ্ছে না।</strong>
                <span>Credential configured আছে, কিন্তু upstream service/hostname unavailable। Service ফিরে এলে form স্বয়ংক্রিয়ভাবে আবার usable হবে।</span>
              </div>
            )}

            <button className="primary" type="submit" disabled={loading || !ready}>
              {loading ? "যাচাই হচ্ছে…" : kind === "nid" ? "NID যাচাই করুন" : "জন্ম নিবন্ধন যাচাই করুন"}
            </button>
          </form>
        </div>

        <aside className="card infoCard">
          <div className="infoIcon">🔐</div>
          <h2>Privacy-first verification</h2>
          <p>API key শুধুমাত্র server-side environment variable-এ থাকে। Browser কখনও credential পায় না।</p>
          <ul>
            <li>Verification input database-এ save হয় না</li>
            <li>Response cache করা হয় না</li>
            <li>Photo, signature, phone, email ও address response থেকে বাদ দেওয়া হয়</li>
            <li>NID/BRN response-এ masked আকারে দেখানো হয়</li>
            <li>Basic abuse rate-limit enabled</li>
          </ul>

          <div className="officialLinks">
            <a href={OFFICIAL_NID} target="_blank" rel="noopener noreferrer">
              <strong>বাংলাদেশ নির্বাচন কমিশন NID Portal</strong>
              <span>services.nidw.gov.bd ↗</span>
            </a>
            <a href={OFFICIAL_BIRTH} target="_blank" rel="noopener noreferrer">
              <strong>Official BDRIS Birth Verification</strong>
              <span>everify.bdris.gov.bd ↗</span>
            </a>
          </div>
        </aside>
      </section>

      {response && (
        <section className="card resultCard">
          <div className="resultHead">
            <div>
              <div className="eyebrow">VERIFICATION RESULT</div>
              <h2>যাচাইকরণ সম্পন্ন</h2>
            </div>
            <div className="verifiedBadge">✓ Verified response</div>
          </div>

          <div className="resultMeta">
            <div><span>ধরন</span><strong>{response.type === "nid" ? "NID" : "Birth Registration"}</strong></div>
            <div><span>আইডি</span><strong>{response.maskedIdentifier}</strong></div>
            <div><span>উৎস</span><strong>{response.source}</strong></div>
            <div><span>সময়</span><strong>{new Date(response.checkedAt).toLocaleString("bn-BD")}</strong></div>
          </div>

          {rows.length ? (
            <div className="resultTable">
              {rows.map(([key, value]) => (
                <div className="resultRow" key={key}>
                  <span>{labelFor(key.split(".").pop() || key)}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
          ) : (
            <div className="emptyResult">Provider verification completed, but no displayable identity fields were returned.</div>
          )}
        </section>
      )}

      <section className="footnote">
        <strong>Important:</strong> এই অ্যাপ Election Commission বা BDRIS-এর বিকল্প সরকারি ওয়েবসাইট নয়।
        NID/BRN যাচাই কেবল অনুমোদিত ব্যবহারের জন্য। Official portal-এর CAPTCHA, login বা access control bypass করা হয় না।
      </section>
    </main>
  );
}
