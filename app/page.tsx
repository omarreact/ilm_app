"use client";

import { useEffect, useMemo, useState } from "react";

type Latest = {
  checkedAt: string;
  category: string;
  status: number | null;
  finalUrl: string | null;
  title: string | null;
  metaDescription: string | null;
  services: string[];
  channels: string[];
  payments: string[];
  loginDetected: boolean | null;
  registerDetected: boolean | null;
  highRiskHits: string[];
  changed: boolean;
  latencyMs: number | null;
  error: string | null;
};

type Portal = {
  id: string;
  domain: string;
  url: string | null;
  risk: "low" | "unverified" | "elevated" | "high";
  research: {
    type?: string;
    summary?: string;
    claims?: string[];
    channels?: string[];
    payments?: string[];
    relations?: string[];
    highRiskIndicators?: string[];
    sources?: string[];
  };
  latest: Latest | null;
};

function badgeClass(value: string) {
  if (value === "high") return "badge high";
  if (value === "elevated") return "badge elevated";
  if (value === "low") return "badge low";
  return "badge neutral";
}

function statusClass(category?: string) {
  if (category === "live") return "badge low";
  if (category === "http_error") return "badge elevated";
  if (category === "unresolved") return "badge neutral";
  if (category) return "badge high";
  return "badge neutral";
}

export default function Home() {
  const [portals, setPortals] = useState<Portal[]>([]);
  const [search, setSearch] = useState("");
  const [risk, setRisk] = useState("");
  const [selected, setSelected] = useState<Portal | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/portals", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || json.error || "Failed to load");
      setPortals(json.portals);
      if (selected) {
        const next = json.portals.find((p: Portal) => p.id === selected.id);
        if (next) setSelected(next);
      }
    } catch (e: any) {
      setMessage(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function scan(id: string) {
    setScanning(prev => new Set(prev).add(id));
    setMessage("");
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Scan failed");
      const observation = json.observation as Latest;
      setPortals(prev => prev.map(p => p.id === id ? { ...p, latest: observation } : p));
      setSelected(prev => prev?.id === id ? { ...prev, latest: observation } : prev);
    } catch (e: any) {
      setMessage(e.message || String(e));
    } finally {
      setScanning(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  async function scanAll() {
    for (const portal of portals) {
      await scan(portal.id);
    }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return portals.filter(p => {
      if (risk && p.risk !== risk) return false;
      if (!q) return true;
      return [
        p.domain,
        p.research.type || "",
        p.research.summary || "",
        ...(p.research.claims || []),
        ...(p.latest?.services || [])
      ].join(" ").toLowerCase().includes(q);
    });
  }, [portals, search, risk]);

  const metrics = {
    total: portals.length,
    high: portals.filter(p => p.risk === "high" || p.risk === "elevated").length,
    live: portals.filter(p => p.latest?.category === "live").length,
    changed: portals.filter(p => p.latest?.changed).length,
    unresolved: portals.filter(p => !p.latest || p.latest.category !== "live").length
  };

  return (
    <main>
      <header className="topbar">
        <div>
          <div className="eyebrow">PUBLIC-SOURCE THREAT INTELLIGENCE</div>
          <h1>Digital Seba Monitor</h1>
          <p>Production server-side monitoring with evidence provenance and passive public GET only.</p>
        </div>
        <div className="topActions">
          <a className="button secondary" href="/api/export">Export JSON</a>
          <button className="button" onClick={scanAll} disabled={loading || scanning.size > 0}>
            {scanning.size ? `Scanning ${scanning.size}…` : "Refresh all"}
          </button>
        </div>
      </header>

      <section className="notice">
        <strong>Safety boundary:</strong> the scanner accepts portal IDs only, never arbitrary URLs. It does not log in, submit NID/phone/payment data, call restricted APIs, or store raw HTML.
      </section>

      {message && <section className="errorBox">{message}</section>}

      <section className="metrics">
        <Metric label="Portals" value={metrics.total} />
        <Metric label="High / elevated" value={metrics.high} />
        <Metric label="Live HTTP" value={metrics.live} />
        <Metric label="Changed" value={metrics.changed} />
        <Metric label="Other / pending" value={metrics.unresolved} />
      </section>

      <section className="panel toolbar">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search domain, service, classification…"
        />
        <select value={risk} onChange={e => setRisk(e.target.value)}>
          <option value="">All risk levels</option>
          <option value="high">High</option>
          <option value="elevated">Elevated</option>
          <option value="low">Low</option>
          <option value="unverified">Unverified</option>
        </select>
        <button className="button secondary" onClick={load}>Reload database</button>
      </section>

      <section className="panel tableWrap">
        <table>
          <thead>
            <tr>
              <th>Portal</th>
              <th>Classification</th>
              <th>Risk</th>
              <th>Latest observation</th>
              <th>Public signals</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.id} onClick={() => setSelected(p)}>
                <td>
                  <strong>{p.domain}</strong>
                  <small>{p.url || "Hostname unresolved"}</small>
                </td>
                <td>
                  {p.research.type || "Unclassified"}
                  <small>{p.research.summary || "No summary"}</small>
                </td>
                <td><span className={badgeClass(p.risk)}>{p.risk}</span></td>
                <td>
                  <span className={statusClass(p.latest?.category)}>
                    {p.latest ? `${p.latest.category}${p.latest.status ? ` · ${p.latest.status}` : ""}` : "not checked"}
                  </span>
                  {p.latest?.changed && <span className="badge changed">changed</span>}
                  <small>{p.latest?.checkedAt ? new Date(p.latest.checkedAt).toLocaleString() : "—"}</small>
                </td>
                <td>
                  <div className="tags">
                    {(p.latest?.services?.length ? p.latest.services : p.research.claims || []).slice(0, 5).map(x =>
                      <span className="tag" key={x}>{x}</span>
                    )}
                  </div>
                </td>
                <td>
                  <button
                    className="iconButton"
                    disabled={scanning.has(p.id)}
                    onClick={e => { e.stopPropagation(); scan(p.id); }}
                    aria-label={`Scan ${p.domain}`}
                  >
                    {scanning.has(p.id) ? "…" : "↻"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && filtered.length === 0 && <div className="empty">No matching portals.</div>}
        {loading && <div className="empty">Loading database…</div>}
      </section>

      {selected && (
        <>
          <div className="overlay" onClick={() => setSelected(null)} />
          <aside className="drawer">
            <div className="drawerHead">
              <div>
                <div className="eyebrow">PORTAL DETAIL</div>
                <h2>{selected.domain}</h2>
              </div>
              <button className="iconButton" onClick={() => setSelected(null)}>×</button>
            </div>

            <div className="drawerBody">
              <div className="rowBadges">
                <span className={badgeClass(selected.risk)}>{selected.risk}</span>
                <span className={statusClass(selected.latest?.category)}>
                  {selected.latest?.category || "not checked"}
                </span>
                {selected.latest?.changed && <span className="badge changed">changed</span>}
              </div>

              <h3>Research snapshot</h3>
              <p>{selected.research.summary || "No summary."}</p>
              <Tags title="Claims / services" values={selected.research.claims} />
              <Tags title="High-risk indicators" values={selected.research.highRiskIndicators} />
              <Tags title="Support channels" values={selected.research.channels} />
              <Tags title="Payments" values={selected.research.payments} />

              <h3>Latest server observation</h3>
              {selected.latest ? (
                <dl className="details">
                  <dt>Checked</dt><dd>{new Date(selected.latest.checkedAt).toLocaleString()}</dd>
                  <dt>HTTP</dt><dd>{selected.latest.status ?? "—"}</dd>
                  <dt>Final URL</dt><dd>{selected.latest.finalUrl || "—"}</dd>
                  <dt>Title</dt><dd>{selected.latest.title || "—"}</dd>
                  <dt>Latency</dt><dd>{selected.latest.latencyMs ? `${selected.latest.latencyMs} ms` : "—"}</dd>
                  <dt>Login detected</dt><dd>{selected.latest.loginDetected === null ? "—" : String(selected.latest.loginDetected)}</dd>
                  <dt>Register detected</dt><dd>{selected.latest.registerDetected === null ? "—" : String(selected.latest.registerDetected)}</dd>
                  <dt>Error</dt><dd>{selected.latest.error || "—"}</dd>
                </dl>
              ) : <p className="muted">No production scan stored yet.</p>}

              <Tags title="Live detected services" values={selected.latest?.services} />
              <Tags title="Live public channels" values={selected.latest?.channels} />
              <Tags title="Live payment keywords" values={selected.latest?.payments} />
              <Tags title="Live high-risk phrase hits" values={selected.latest?.highRiskHits} />

              <h3>Evidence sources</h3>
              <div className="sources">
                {(selected.research.sources || []).map(url => (
                  <a key={url} href={url} target="_blank" rel="noopener noreferrer">{url}</a>
                ))}
              </div>

              <button className="button wide" onClick={() => scan(selected.id)} disabled={scanning.has(selected.id)}>
                {scanning.has(selected.id) ? "Scanning…" : "Scan this portal"}
              </button>
            </div>
          </aside>
        </>
      )}
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong></div>;
}

function Tags({ title, values }: { title: string; values?: string[] }) {
  return (
    <div className="tagGroup">
      <label>{title}</label>
      <div className="tags">
        {values?.length ? values.map(v => <span className="tag" key={v}>{v}</span>) : <span className="muted">—</span>}
      </div>
    </div>
  );
}
