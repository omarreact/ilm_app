export type Risk = "low" | "unverified" | "elevated" | "high";

export type ResearchSnapshot = {
  type?: string;
  risk?: Risk;
  summary?: string;
  claims?: string[];
  channels?: string[];
  payments?: string[];
  relations?: string[];
  highRiskIndicators?: string[];
  sources?: string[];
};

export type Portal = {
  id: string;
  domain: string;
  url: string | null;
  risk: Risk;
  research: ResearchSnapshot;
};

export type Observation = {
  id?: number;
  portalId: string;
  checkedAt: string;
  category: "live" | "http_error" | "timeout" | "network_error" | "invalid_target" | "unresolved";
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
  contentHash: string | null;
  changed: boolean;
  latencyMs: number | null;
  error: string | null;
};
