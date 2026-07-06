import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Bug, ShieldAlert, AlertTriangle, Info } from "lucide-react";
import { PageHeader, Panel, StatCard, SeverityBadge } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { ISO27001Badge, ViewStandardLink, ExportReportButton } from "@/components/dashboard/ISO27001";
import { ScanControls } from "@/components/dashboard/ScanControls";

export const Route = createFileRoute("/dashboard/sast")({ component: SastPage });

const BACKEND_URL = "http://127.0.0.1:8000";

// ── Types matching the backend response ──
type BackendFinding = {
  title: string;
  severity: string; // "ERROR" | "WARNING" | "INFO"
  file: string;
  line: number;
  description: string;
  rule: string;
  cwe?: string;
  owasp?: string;
  iso27001_control?: string;
  iso27001_control_name?: string;
  iso27001_description?: string;
};

type Finding = {
  id: number;
  title: string;
  severity: "critical" | "high" | "medium" | "low";
  file: string;
  line: number;
  description: string;
  rule: string;
  cwe: string;
  owasp: string;
  iso27001Control: string;
  iso27001ControlName: string;
  iso27001Description: string;
};

function mapSeverity(raw: string): Finding["severity"] {
  const s = raw?.toUpperCase();
  if (s === "ERROR") return "critical";
  if (s === "WARNING") return "high";
  if (s === "INFO") return "medium";
  return "low";
}

function extractCWE(rule: string): string {
  if (rule.includes("sql")) return "CWE-89";
  if (rule.includes("xss")) return "CWE-79";
  if (rule.includes("csrf")) return "CWE-352";
  if (rule.includes("hardcode")) return "CWE-798";
  if (rule.includes("path")) return "CWE-22";
  if (rule.includes("exec")) return "CWE-78";
  if (rule.includes("injection")) return "CWE-89";
  if (rule.includes("crypto")) return "CWE-327";
  if (rule.includes("auth")) return "CWE-287";
  return "CWE-000";
}

function extractOWASP(rule: string): string {
  if (rule.includes("sql") || rule.includes("injection") || rule.includes("xss")) return "A03:2021";
  if (rule.includes("csrf")) return "A01:2021";
  if (rule.includes("hardcode") || rule.includes("secret") || rule.includes("crypto")) return "A02:2021";
  if (rule.includes("auth")) return "A07:2021";
  if (rule.includes("path")) return "A01:2021";
  if (rule.includes("exec")) return "A03:2021";
  return "A05:2021";
}

function extractISO(rule: string) {
  if (rule.includes("hardcode") || rule.includes("secret")) {
    return { control: "5.17", name: "Authentication information", description: "Allocation and management of authentication information shall be controlled by a management process, including advising personnel on appropriate handling of authentication information." };
  }
  if (rule.includes("auth")) {
    return { control: "8.5", name: "Secure authentication", description: "Secure authentication technologies and procedures shall be implemented based on information access restrictions and the topic-specific policy on access control." };
  }
  if (rule.includes("crypto")) {
    return { control: "8.24", name: "Use of cryptography", description: "Rules for the effective use of cryptography, including cryptographic key management, shall be defined and implemented." };
  }
  if (rule.includes("csrf")) {
    return { control: "8.26", name: "Application security requirements", description: "Information security requirements shall be identified, specified and approved when developing or acquiring applications." };
  }
  return { control: "8.28", name: "Secure coding", description: "Secure coding principles shall be applied to software development." };
}

function normalize(data: BackendFinding[]): Finding[] {
  return data.map((item, index) => {
    const ruleLower = item.rule?.toLowerCase() || "";
    const iso = extractISO(ruleLower);
    return {
      id: index + 1,
      title: item.title || "Untitled Finding",
      severity: mapSeverity(item.severity),
      file: item.file || "unknown",
      line: item.line || 0,
      description: item.description || "",
      rule: item.rule || "",
      cwe: item.cwe || extractCWE(ruleLower),
      owasp: item.owasp || extractOWASP(ruleLower),
      iso27001Control: item.iso27001_control || iso.control,
      iso27001ControlName: item.iso27001_control_name || iso.name,
      iso27001Description: item.iso27001_description || iso.description,
    };
  });
}

function shortPath(path: string) {
  const parts = path.replace(/\\/g, "/").split("/");
  return parts.length > 3 ? ".../" + parts.slice(-3).join("/") : path;
}

const EXAMPLE_REPOS = [
  "https://github.com/pallets/flask",
  "https://github.com/django/django",
  "https://github.com/expressjs/express",
];

function SastPage() {
  const [scanMode, setScanMode] = useState<"github" | "local">("github");
  const [repoUrl, setRepoUrl] = useState("https://github.com/pallets/flask");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasScanned, setHasScanned] = useState(false);
  const [scanTime, setScanTime] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState("all");

  const runScan = async () => {
    if (scanMode === "github" && !repoUrl.trim()) { setError("Please enter a GitHub repository URL"); return; }
    if (scanMode === "local" && !selectedFile) { setError("Please select a .zip file to upload"); return; }

    setScanning(true);
    setError(null);
    setFindings([]);
    const startTime = Date.now();

    try {
      let response: Response;
      if (scanMode === "github") {
        response = await fetch(`${BACKEND_URL}/api/sast/scan`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ repo_url: repoUrl.trim() }),
        });
      } else {
        const formData = new FormData();
        formData.append("file", selectedFile as File);
        response = await fetch(`${BACKEND_URL}/api/sast/scan-local`, { method: "POST", body: formData });
      }

      if (!response.ok) throw new Error(`Backend error ${response.status}: ${await response.text()}`);
      const data: BackendFinding[] = await response.json();
      if (!Array.isArray(data)) throw new Error("Backend did not return an array of findings");

      setFindings(normalize(data));
      setHasScanned(true);
      setScanTime(Math.round((Date.now() - startTime) / 1000));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setScanning(false);
    }
  };

  const counts = {
    critical: findings.filter((f) => f.severity === "critical").length,
    high: findings.filter((f) => f.severity === "high").length,
    medium: findings.filter((f) => f.severity === "medium").length,
    low: findings.filter((f) => f.severity === "low").length,
  };

  const filtered = findings.filter((f) => activeTab === "all" || f.severity === activeTab);

  const reportFindings = findings.map((f) => ({
    title: f.title, severity: f.severity, file: f.file, line: f.line,
    description: f.description, rule: f.rule, cwe: f.cwe, owasp: f.owasp,
    scanner: "semgrep",
    iso27001_control: f.iso27001Control,
    iso27001_control_name: f.iso27001ControlName,
    iso27001_description: f.iso27001Description,
  }));

  return (
    <>
      <PageHeader
        eyebrow="Scanner · SAST"
        title="Static Application Security Testing"
        description="Deep static analysis via Semgrep — injection, XSS, auth flaws, and more."
        actions={
          <div className="flex flex-wrap gap-2">
            <ViewStandardLink />
            <ExportReportButton findings={reportFindings} scanType="sast" repoLabel={scanMode === "github" ? repoUrl : selectedFile?.name || ""} />
          </div>
        }
      />

      <ScanControls
        scanMode={scanMode} setScanMode={setScanMode}
        repoUrl={repoUrl} setRepoUrl={setRepoUrl}
        selectedFile={selectedFile} setSelectedFile={setSelectedFile}
        onRun={runScan} scanning={scanning} error={error} scanTime={scanTime}
        exampleRepos={EXAMPLE_REPOS} runLabel="Run SAST Scan"
      />

      {hasScanned && (
        <>
          <div className="mb-6 grid gap-4 md:grid-cols-4">
            <StatCard label="Critical" value={String(counts.critical)} tone="critical" icon={ShieldAlert} />
            <StatCard label="High" value={String(counts.high)} tone="warning" icon={AlertTriangle} />
            <StatCard label="Medium" value={String(counts.medium)} tone="info" icon={Info} />
            <StatCard label="Low" value={String(counts.low)} tone="info" icon={Bug} />
          </div>

          <Panel>
            <div className="mb-5 flex flex-wrap items-center gap-2">
              {[
                { key: "all", label: "All", count: findings.length },
                { key: "critical", label: "Critical", count: counts.critical },
                { key: "high", label: "High", count: counts.high },
                { key: "medium", label: "Medium", count: counts.medium },
                { key: "low", label: "Low", count: counts.low },
              ].map((t) => (
                <Button key={t.key} variant={activeTab === t.key ? "secondary" : "ghost"} size="sm" onClick={() => setActiveTab(t.key)}>
                  {t.label} <span className="ml-1 opacity-60">{t.count}</span>
                </Button>
              ))}
            </div>

            <div className="-mx-6 overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    <th className="px-6 py-3 font-medium">Vulnerability</th>
                    <th className="px-3 py-3 font-medium">Severity</th>
                    <th className="px-3 py-3 font-medium">File · Line</th>
                    <th className="px-3 py-3 font-medium">CWE</th>
                    <th className="px-3 py-3 font-medium">OWASP</th>
                    <th className="px-6 py-3 font-medium">ISO 27001</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr><td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">No findings for this filter.</td></tr>
                  )}
                  {filtered.map((f) => (
                    <tr key={f.id} className="border-b border-border/40 transition-colors hover:bg-secondary/40">
                      <td className="px-6 py-3">
                        <div className="font-medium">{f.title}</div>
                        <div className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">{f.rule}</div>
                      </td>
                      <td className="px-3 py-3"><SeverityBadge level={f.severity} /></td>
                      <td className="px-3 py-3 font-mono text-xs text-info" title={f.file}>{shortPath(f.file)}:{f.line}</td>
                      <td className="px-3 py-3 font-mono text-xs text-muted-foreground">{f.cwe}</td>
                      <td className="px-3 py-3 font-mono text-xs text-muted-foreground">{f.owasp}</td>
                      <td className="px-6 py-3">
                        <ISO27001Badge info={{ control: f.iso27001Control, controlName: f.iso27001ControlName, description: f.iso27001Description }} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}

      {!hasScanned && !scanning && (
        <Panel>
          <div className="grid place-items-center py-16 text-center text-sm text-muted-foreground">
            <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">✦</div>
            <div className="font-medium text-foreground">Ready to scan</div>
            <div className="mt-1 max-w-sm">
              {scanMode === "github"
                ? "Enter a GitHub repository URL above and run a SAST scan to detect vulnerabilities with Semgrep."
                : "Upload a .zip of your project above and run a SAST scan to detect vulnerabilities with Semgrep."}
            </div>
          </div>
        </Panel>
      )}
    </>
  );
}
