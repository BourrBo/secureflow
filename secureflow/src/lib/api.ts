import { supabase } from "./supabaseClient";

const RAW = import.meta.env.VITE_API_URL as string | undefined;
export const API_URL = (RAW && RAW.replace(/\/$/, "")) || "http://localhost:8000";

export type ApiUser = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  avatar_url?: string | null;
};

/* ── Domain types (tolerant to backend field naming) ───────────────── */

export type ApiSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";

export type ApiFinding = {
  id?: string | number;
  title?: string;
  message?: string;
  description?: string;
  rule_id?: string;
  rule?: string;
  severity?: string;
  scanner?: string;
  project_id?: string | number;
  project_name?: string;
  scan_id?: string | number;
  file_path?: string;
  file?: string;
  line?: number | null;
  status?: string;
  created_at?: string;
  cwe?: string | null;
  owasp?: string | null;
  iso27001_control?: string | null;
  iso27001_control_name?: string | null;
  iso27001_description?: string | null;
  ecosystem?: string | null;
  installed_version?: string | null;
  fixed_version?: string | null;
  cve?: string | null;
  cvss?: number | string | null;
  epss_score?: number | string | null;
  epss_percentile?: number | string | null;
  recommendation?: string | null;
  references?: string[] | null;
  code_context?: Array<{ ln?: number; code?: string; highlight?: boolean }> | null;
  priority_score?: number | string | null;
  priority_basis?: string | null;
  priority_risk_level?: string | null;
  [k: string]: unknown;
};

export type FindingsResponse = { count: number; total?: number; findings: ApiFinding[] };

export type ApiProject = {
  id: string | number;
  name?: string;
  repo_url?: string;
  branch?: string;
  language?: string;
  created_at?: string;
  scans_count?: number;
  findings_count?: number;
  [k: string]: unknown;
};

export type ApiScan = {
  id: string | number;
  project_id?: string | number;
  scanner?: string;
  status?: string;
  started_at?: string;
  finished_at?: string;
  created_at?: string;
  findings_count?: number;
  [k: string]: unknown;
};

export type ApiComplianceFramework = {
  name?: string;
  framework?: string;
  score?: number;
  percentage?: number;
  passed?: number;
  total?: number;
  controls_passed?: number;
  controls_total?: number;
  [k: string]: unknown;
};

export type FindingsQuery = {
  project_id?: string | number;
  scan_id?: string | number;
  severity?: ApiSeverity;
  scanner?: string;
  q?: string;
  limit?: number;
  offset?: number;
};

export type ApiGateRun = {
  id: string | number;
  project_id: string | number;
  project_name?: string;
  scan_id?: string | number | null;
  fail_on: string;
  passed: boolean;
  blocking_count: number;
  total_findings: number;
  commit_sha?: string | null;
  triggered_by?: string | null;
  created_at: string;
};

export type ApiApiKey = {
  id: string | number;
  name: string;
  key_prefix: string;
  project_id?: string | number | null;
  created_at: string;
  last_used_at?: string | null;
  revoked_at?: string | null;
};

export type ApiBlockingFinding = {
  id: string | number;
  title?: string;
  severity?: string;
  scanner?: string;
  file?: string;
};

function qs(params: Record<string, unknown>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

/** Current Supabase session's access token, or null if signed out. Every
 * request below sends this as `Authorization: Bearer <token>` — the backend
 * verifies it against Supabase (see services/auth_service.py) to get the
 * user id it scopes every query by. */
async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  headers.set("ngrok-skip-browser-warning", "true");
  const token = await getAccessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...init, headers });
  } catch (e) {
    throw new Error(
      `Could not reach SecureFlow backend at ${API_URL}. Make sure it's running (uvicorn main:app --port 8000) and VITE_API_URL points to it.`,
    );
  }
  const text = await res.text();
  const data = text ? (JSON.parse(text) as unknown) : null;
  if (!res.ok) {
    const detail =
      (data &&
        typeof data === "object" &&
        "detail" in data &&
        (data as { detail: unknown }).detail) ||
      res.statusText ||
      "Request failed";
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  return data as T;
}

/** Multipart upload — must NOT set Content-Type (the browser adds the boundary). */
async function upload<T>(path: string, file: File): Promise<T> {
  const headers = new Headers();
  headers.set("ngrok-skip-browser-warning", "true");
  const token = await getAccessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const body = new FormData();
  body.append("file", file);
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { method: "POST", headers, body });
  } catch {
    throw new Error(`Could not reach SecureFlow backend at ${API_URL}.`);
  }
  const text = await res.text();
  const data = text ? (JSON.parse(text) as unknown) : null;
  if (!res.ok) {
    const detail =
      (data &&
        typeof data === "object" &&
        "detail" in data &&
        (data as { detail: unknown }).detail) ||
      res.statusText ||
      "Upload failed";
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  return data as T;
}

async function requestBlob(path: string, init: RequestInit = {}): Promise<Blob> {
  const headers = new Headers();
  headers.set("ngrok-skip-browser-warning", "true");
  if (init.body) headers.set("Content-Type", "application/json");
  const token = await getAccessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...init, headers });
  } catch {
    throw new Error(`Could not reach SecureFlow backend at ${API_URL}.`);
  }
  if (!res.ok) {
    let detail = res.statusText || "Download failed";
    try {
      const j = (await res.json()) as { detail?: unknown };
      if (typeof j?.detail === "string") detail = j.detail;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(detail);
  }
  return res.blob();
}

export type ScanResponse = { scan_id?: string | number; [k: string]: unknown };
/** DAST is full-assessment only in this product — no depth choice. */
export type DastMode = "full";

/**
 * POST /api/dast/scan returns immediately (it does not block for the scan's
 * full duration) — this is the shape of that immediate response.
 */
export type DastScanStartResponse = {
  scan_id: number;
  status: "running";
  target_url: string;
  scan_mode: DastMode;
};

/** Shape returned by GET /api/dast/scan/{scan_id} while polling. */
export type DastScanStatusResponse = {
  scan_id: number;
  status: "running" | "completed" | "failed";
  started_at?: string | null;
  finished_at?: string | null;
  progress_phase?: string | null;
  progress_pct?: number | null;
  findings?: ApiFinding[];
  error?: string;
};

/** Body accepted by POST /api/reports/pdf (ISO-27001 report from in-memory findings). */
export type ReportPdfRequest = {
  findings: Array<Record<string, unknown>>;
  scan_type: string;
  repo_label: string;
};

export const api = {
  listFindings: (q: FindingsQuery = {}) => request<FindingsResponse>(`/api/findings${qs(q)}`),
  clearFindings: () => request<{ deleted: number }>("/api/findings", { method: "DELETE" }),
  /** Destructive workspace reset: deletes the user's findings, scans and projects. */
  clearWorkspace: () =>
    request<{ findings?: number; scans?: number; projects?: number; deleted?: number }>(
      "/api/findings/all",
      { method: "DELETE" },
    ),
  listProjects: () => request<ApiProject[] | { projects: ApiProject[] }>("/api/projects"),
  getProject: (id: string | number) => request<ApiProject>(`/api/projects/${id}`),
  getProjectScans: (id: string | number) =>
    request<ApiScan[] | { scans: ApiScan[] }>(`/api/projects/${id}/scans`),
  getCompliance: () =>
    request<ApiComplianceFramework[] | { frameworks: ApiComplianceFramework[] }>("/api/compliance"),

  /* ── Scan triggers (paths mirror the backend contract exactly) ───── */

  /** Repo scan for a git-based module. SCA is Trivy-backed and has its own endpoint. */
  scanRepo: (base: "sast" | "sca" | "iac" | "secrets", repo_url: string) =>
    request<ScanResponse>(`/api/${base}/scan`, {
      method: "POST",
      body: JSON.stringify({ repo_url }),
    }),
  scanLocal: (base: "sast" | "sca" | "iac" | "secrets", file: File) =>
    upload<ScanResponse>(`/api/${base}/scan-local`, file),
  scanContainer: (image_name: string) =>
    request<ScanResponse>("/api/container/scan", {
      method: "POST",
      body: JSON.stringify({ image_name }),
    }),
  /**
   * Kicks off a DAST scan and returns immediately with a scan_id — it does
   * NOT wait for the scan to finish. Poll getDastScanStatus() with the
   * returned scan_id until status is "completed" or "failed".
   */
  scanDast: (target_url: string, scan_mode: DastMode = "full") =>
    request<DastScanStartResponse>("/api/dast/scan", {
      method: "POST",
      body: JSON.stringify({ target_url, scan_mode }),
    }),
  getDastScanStatus: (scanId: string | number) =>
    request<DastScanStatusResponse>(`/api/dast/scan/${scanId}`),

  reportPdf: (scanId: string | number) => requestBlob(`/api/reports/${scanId}/pdf`),

  /* ── CI/CD gate + API keys ───────────────────────────────────────── */

  evaluateGate: (body: {
    project_id: string | number;
    fail_on: string;
    scan_id?: string | number;
    commit_sha?: string;
    triggered_by?: string;
  }) =>
    request<ApiGateRun & { blocking_findings: ApiBlockingFinding[] }>("/api/gate/evaluate", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  listGateRuns: (project_id?: string | number) =>
    request<{ runs: ApiGateRun[] }>(`/api/gate/runs${qs({ project_id })}`),
  listApiKeys: () => request<{ keys: ApiApiKey[] }>("/api/keys"),
  createApiKey: (name: string, project_id?: string | number) =>
    request<ApiApiKey & { key: string }>("/api/keys", {
      method: "POST",
      body: JSON.stringify({ name, project_id }),
    }),
  revokeApiKey: (id: string | number) =>
    request<{ revoked: boolean }>(`/api/keys/${id}`, { method: "DELETE" }),

  /** Generates a report directly from the findings of the scan just run. */
  reportPdfFromFindings: (body: ReportPdfRequest) =>
    requestBlob("/api/reports/pdf", { method: "POST", body: JSON.stringify(body) }),
};
