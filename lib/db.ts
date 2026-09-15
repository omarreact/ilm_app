import postgres from "postgres";
import type { Observation } from "./types";

let client: ReturnType<typeof postgres> | null = null;

function db() {
  if (!process.env.DATABASE_URL) {
    return null;
  }
  if (!client) {
    client = postgres(process.env.DATABASE_URL, {
      max: 8,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false
    });
  }
  return client;
}

function rowToObservation(row: any): Observation {
  return {
    id: Number(row.id),
    portalId: row.portal_id,
    checkedAt: new Date(row.checked_at).toISOString(),
    category: row.category,
    status: row.status ?? null,
    finalUrl: row.final_url ?? null,
    title: row.title ?? null,
    metaDescription: row.meta_description ?? null,
    services: row.services ?? [],
    channels: row.channels ?? [],
    payments: row.payments ?? [],
    loginDetected: row.login_detected ?? null,
    registerDetected: row.register_detected ?? null,
    highRiskHits: row.high_risk_hits ?? [],
    contentHash: row.content_hash ?? null,
    changed: Boolean(row.changed),
    latencyMs: row.latency_ms ?? null,
    error: row.error ?? null
  };
}

export async function getLatestObservation(portalId: string): Promise<Observation | null> {
  const sql = db();
  if (!sql) return null;
  const rows = await sql`
    SELECT * FROM observations
    WHERE portal_id = ${portalId}
    ORDER BY checked_at DESC
    LIMIT 1
  `;
  return rows[0] ? rowToObservation(rows[0]) : null;
}

export async function getLatestObservations(): Promise<Record<string, Observation>> {
  const sql = db();
  if (!sql) return {};
  const rows = await sql`
    SELECT DISTINCT ON (portal_id) *
    FROM observations
    ORDER BY portal_id, checked_at DESC
  `;
  return Object.fromEntries(rows.map((r: any) => [r.portal_id, rowToObservation(r)]));
}

export async function getHistory(limit = 1000): Promise<Observation[]> {
  const sql = db();
  if (!sql) return [];
  const safeLimit = Math.min(Math.max(limit, 1), 5000);
  const rows = await sql`
    SELECT * FROM observations
    ORDER BY checked_at DESC
    LIMIT ${safeLimit}
  `;
  return rows.map(rowToObservation);
}

export async function saveObservation(obs: Observation): Promise<Observation> {
  const sql = db();
  if (!sql) return obs;
  const rows = await sql`
    INSERT INTO observations (
      portal_id, checked_at, category, status, final_url, title, meta_description,
      services, channels, payments, login_detected, register_detected,
      high_risk_hits, content_hash, changed, latency_ms, error
    ) VALUES (
      ${obs.portalId}, ${obs.checkedAt}, ${obs.category}, ${obs.status}, ${obs.finalUrl},
      ${obs.title}, ${obs.metaDescription},
      ${sql.json(obs.services)}, ${sql.json(obs.channels)}, ${sql.json(obs.payments)},
      ${obs.loginDetected}, ${obs.registerDetected}, ${sql.json(obs.highRiskHits)},
      ${obs.contentHash}, ${obs.changed}, ${obs.latencyMs}, ${obs.error}
    )
    RETURNING *
  `;
  return rowToObservation(rows[0]);
}

export async function healthCheck(): Promise<boolean> {
  const sql = db();
  if (!sql) return false;
  const rows = await sql`SELECT 1 AS ok`;
  return rows[0]?.ok === 1;
}
