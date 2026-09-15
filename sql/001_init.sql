CREATE TABLE IF NOT EXISTS observations (
  id BIGSERIAL PRIMARY KEY,
  portal_id TEXT NOT NULL,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  category TEXT NOT NULL,
  status INTEGER,
  final_url TEXT,
  title TEXT,
  meta_description TEXT,
  services JSONB NOT NULL DEFAULT '[]'::jsonb,
  channels JSONB NOT NULL DEFAULT '[]'::jsonb,
  payments JSONB NOT NULL DEFAULT '[]'::jsonb,
  login_detected BOOLEAN,
  register_detected BOOLEAN,
  high_risk_hits JSONB NOT NULL DEFAULT '[]'::jsonb,
  content_hash TEXT,
  changed BOOLEAN NOT NULL DEFAULT FALSE,
  latency_ms INTEGER,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS observations_portal_checked_idx ON observations (portal_id, checked_at DESC);
CREATE INDEX IF NOT EXISTS observations_checked_idx ON observations (checked_at DESC);
