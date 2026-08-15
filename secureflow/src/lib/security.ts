import type { ApiFinding, ApiProject, ApiScan, ApiComplianceFramework } from "./api";

/** Category identifiers surfaced in the UI. Engine names are never exposed. */
export type ModuleKey = "sast" | "sca" | "secrets" | "iac" | "container" | "dast";

export const MODULE_LABEL: Record<ModuleKey, string> = {
  sast: "SAST",
  sca: "SCA",
  secrets: "Secrets",
  iac: "IaC",
  container: "Container",
  dast: "DAST",
};

/**
 * Backend `scanner` values are engine identifiers. They are mapped to a
 * capability category here and the raw value is never rendered.
 */
const ENGINE_TO_MODULE: Record<string, ModuleKey> = {
  semgrep: "sast",
  sast: "sast",
  bandit: "sast",
  osv: "sca",
  "osv-scanner": "sca",
  sca: "sca",
  dependency: "sca",
  secrets: "secrets",
  gitleaks: "secrets",
  trufflehog: "secrets",
  checkov: "iac",
  kics: "iac",
  terrascan: "iac",
  iac: "iac",
  trivy: "sca",
  grype: "container",
  container: "container",
  zap: "dast",
  dast: "dast",
};

/** Query value sent to the backend for a given UI module. */
export const MODULE_TO_ENGINE: Record<ModuleKey, string> = {
  sast: "semgrep",
  sca: "trivy",
  secrets: "secrets",
  iac: "checkov",
  container: "container",
  dast: "zap",
};

export function moduleFromScanner(raw?: string): ModuleKey | null {
  if (!raw) return null;
  return ENGINE_TO_MODULE[raw.toLowerCase().trim()] ?? null;
}

/** Public-safe display name for a backend scanner value. */
export function scannerLabel(raw?: string): string {
  const m = moduleFromScanner(raw);
  return m ? MODULE_LABEL[m] : "Scanner";
}

export type Severity = "critical" | "high" | "medium" | "low" | "info";

export function normalizeSeverity(raw?: string): Severity {
  const s = (raw ?? "").toLowerCase();
  if (s.startsWith("crit")) return "critical";
  if (s.startsWith("high") || s === "error") return "high";
  if (s.startsWith("med") || s === "warning") return "medium";
  if (s.startsWith("low")) return "low";
  return "info";
}

export const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low", "info"];

export type Finding = {
  id: string;
  title: string;
  project: string;
  scanId: string | null;
  module: ModuleKey | null;
  moduleLabel: string;
  severity: Severity;
  location: string;
  createdAt: Date | null;
  status: string;
  /** Raw backend payload, kept for report export. */
  raw: ApiFinding;
  description: string;
  rule: string;
  file: string;
  line: number | null;
  cwe: string;
  owasp: string;
  iso: { control: string; name: string; description: string } | null;
  ecosystem: string;
  installedVersion: string;
  fixedVersion: string;
  cve: string;
  cvss: string;
  epssScore: string;
  epssPercentile: string;
  recommendation: string;
  references: string[];
  codeContext: Array<{ ln: number | null; code: string; highlight: boolean }>;
  priorityScore: number | null;
  priorityBasis: PriorityBasis | null;
  priorityRiskLevel: PriorityRisk | null;
};

export type PriorityRisk = "critical" | "high" | "medium" | "low";
export type PriorityBasis = "epss" | "cwe-weighted";

export function priorityTooltip(basis: PriorityBasis | null): string {
  if (basis === "epss") return "Based on real-world exploitation probability (EPSS)";
  if (basis === "cwe-weighted")
    return "Based on this weakness class's severity in MITRE's CWE Top 25, since no CVE/EPSS data applies here";
  return "No priority data available";
}

function normalizePriorityRisk(raw: unknown): PriorityRisk | null {
  const s = String(raw ?? "").toLowerCase();
  if (s.startsWith("crit")) return "critical";
  if (s.startsWith("high")) return "high";
  if (s.startsWith("med")) return "medium";
  if (s.startsWith("low")) return "low";
  return null;
}

function normalizePriorityBasis(raw: unknown): PriorityBasis | null {
  const s = String(raw ?? "")
    .toLowerCase()
    .trim();
  if (s === "epss") return "epss";
  if (s === "cwe-weighted" || s === "cwe weighted" || s === "cwe_weighted") return "cwe-weighted";
  return null;
}

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));

export function normalizeFinding(f: ApiFinding, index: number): Finding {
  const created = f.created_at ? new Date(f.created_at) : null;
  const module = moduleFromScanner(f.scanner);
  const file = str(f.file_path || f.file);
  const control = str(f.iso27001_control);
  return {
    id: String(f.id ?? f.rule_id ?? `F-${index + 1}`),
    title: String(f.title || f.message || f.description || f.rule_id || "Untitled finding"),
    project: String(f.project_name ?? f.project_id ?? "—"),
    scanId: f.scan_id !== undefined && f.scan_id !== null ? String(f.scan_id) : null,
    module,
    moduleLabel: module ? MODULE_LABEL[module] : "Scanner",
    severity: normalizeSeverity(f.severity),
    location: file ? (f.line ? `${file}:${f.line}` : file) : "",
    createdAt: created && !Number.isNaN(created.getTime()) ? created : null,
    status: String(f.status ?? "open"),
    raw: f,
    description: str(f.description || f.message),
    rule: str(f.rule || f.rule_id),
    file,
    line: typeof f.line === "number" ? f.line : null,
    cwe: str(f.cwe),
    owasp: str(f.owasp),
    iso: control
      ? {
          control,
          name: str(f.iso27001_control_name),
          description: str(f.iso27001_description),
        }
      : null,
    ecosystem: str(f.ecosystem),
    installedVersion: str(f.installed_version),
    fixedVersion: str(f.fixed_version),
    cve: str(f.cve),
    cvss: str(f.cvss),
    epssScore: str(f.epss_score),
    epssPercentile: str(f.epss_percentile),
    recommendation: str(f.recommendation),
    references: Array.isArray(f.references) ? f.references.map(str).filter(Boolean) : [],
    codeContext: Array.isArray(f.code_context)
      ? f.code_context.map((c) => ({
          ln: typeof c?.ln === "number" ? c.ln : null,
          code: str(c?.code),
          highlight: Boolean(c?.highlight),
        }))
      : [],
    priorityScore:
      f.priority_score === null || f.priority_score === undefined || f.priority_score === ""
        ? null
        : Number.isFinite(Number(f.priority_score))
          ? Number(f.priority_score)
          : null,
    priorityBasis: normalizePriorityBasis(f.priority_basis),
    priorityRiskLevel: normalizePriorityRisk(f.priority_risk_level),
  };
}

/** "aws-secret-key" -> "Aws Secret Key"; entropy rule gets a friendly name. */
export function secretTypeLabel(rule: string): string {
  if (!rule) return "Secret";
  if (rule === "entropy-generic") return "High-Entropy String";
  return rule
    .replace(/[-_]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Pulls the redacted match out of a secrets finding description. */
export function redactedMatch(description: string): string {
  const m = /\(matched: (.+)\)\s*$/.exec(description ?? "");
  return m ? m[1] : "—";
}

/** Derives an IaC category from the file path. */
export function iacCategory(file: string): string {
  const p = (file ?? "").toLowerCase();
  if (p.includes("k8s") || p.endsWith(".yaml") || p.endsWith(".yml")) return "K8s";
  if (p.includes("docker")) return "Docker";
  if (p.includes("helm")) return "Helm";
  if (p.includes("terraform") || p.endsWith(".tf")) return "Terraform";
  if (p.includes("iam")) return "IAM";
  if (p.includes("cloudformation") || p.endsWith(".json")) return "CloudFormation";
  return "IaC";
}

export type Project = {
  id: string;
  name: string;
  branch: string;
  language: string;
  scans: number | null;
  findings: number | null;
};

export function normalizeProject(p: ApiProject): Project {
  return {
    id: String(p.id),
    name: String(p.name ?? p.repo_url ?? `Project ${p.id}`),
    branch: String(p.branch ?? "main"),
    language: String(p.language ?? "—"),
    scans: typeof p.scans_count === "number" ? p.scans_count : null,
    findings: typeof p.findings_count === "number" ? p.findings_count : null,
  };
}

export type Scan = {
  id: string;
  moduleLabel: string;
  status: string;
  at: Date | null;
  findings: number | null;
};

export function normalizeScan(s: ApiScan): Scan {
  const raw = s.finished_at ?? s.started_at ?? s.created_at;
  const d = raw ? new Date(raw) : null;
  return {
    id: String(s.id),
    moduleLabel: scannerLabel(s.scanner),
    status: String(s.status ?? "completed"),
    at: d && !Number.isNaN(d.getTime()) ? d : null,
    findings: typeof s.findings_count === "number" ? s.findings_count : null,
  };
}

export type Framework = { name: string; pct: number; controls: string | null };

export function normalizeFramework(f: ApiComplianceFramework): Framework {
  const pctRaw =
    typeof f.percentage === "number" ? f.percentage : typeof f.score === "number" ? f.score : 0;
  const pct = Math.max(0, Math.min(100, Math.round(pctRaw <= 1 ? pctRaw * 100 : pctRaw)));
  const passed = f.controls_passed ?? f.passed;
  const total = f.controls_total ?? f.total;
  return {
    name: String(f.name ?? f.framework ?? "Framework"),
    pct,
    controls:
      typeof passed === "number" && typeof total === "number" ? `${passed} / ${total}` : null,
  };
}

export function countBySeverity(findings: Finding[]) {
  const c: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const f of findings) c[f.severity] += 1;
  return c;
}

export function relativeTime(d: Date | null): string {
  if (!d) return "—";
  const diff = Date.now() - d.getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const days = Math.round(h / 24);
  return `${days}d`;
}

/** Daily severity counts for the last `days` days, derived from findings. */
export function buildTrend(findings: Finding[], days = 7) {
  const out: Array<{ d: string; critical: number; high: number; medium: number }> = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(now);
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - i);
    const next = new Date(day);
    next.setDate(next.getDate() + 1);
    const open = findings.filter((f) => !f.createdAt || f.createdAt < next);
    const c = countBySeverity(open);
    out.push({
      d: day.toLocaleDateString(undefined, { weekday: "short" }),
      critical: c.critical,
      high: c.high,
      medium: c.medium,
    });
  }
  return out;
}

/** Weighted 0–100 posture score derived from real severity counts. */
export function securityScore(findings: Finding[]) {
  const c = countBySeverity(findings);
  const weighted = c.critical * 10 + c.high * 5 + c.medium * 1.5 + c.low * 0.4;
  // Diminishing returns: score decays smoothly toward 0 as weighted
  // severity grows, instead of hitting a hard floor after a fixed count.
  // scale=40 means ~40 weighted points ≈ score of 50.
  const scale = 40;
  const score = 100 * (scale / (scale + weighted));
  return Math.max(0, Math.min(100, Math.round(score)));
}
