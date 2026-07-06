import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { KeyRound, ShieldAlert, AlertTriangle, Info } from "lucide-react";
import { PageHeader, Panel, StatCard, SeverityBadge } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { ISO27001Badge, ViewStandardLink, ExportReportButton } from "@/components/dashboard/ISO27001";
import { ScanControls } from "@/components/dashboard/ScanControls";

export const Route = createFileRoute("/dashboard/secrets")({ component: SecretsPage });

const BACKEND_URL = "http://127.0.0.1:8000";

type BackendFinding = {
  title: string;
  severity: string; // already lowercase: critical/high/medium/low
  file: string;
  line: number;
  description: string; // includes "(matched: <redacted value>)"
  rule: string;
  cwe: string;
  owasp: string;
  scanner: string; // only "secrets" rows are kept here
  iso27001_control?: string;
  iso27001_control_name?: string;
  iso27001_description?: string;
};

type Secret = {
  id: number;
  type: string;
  ruleId: string;
  redactedMatch: string;
  detectionMethod: "pattern" | "entropy" | "unknown";
  severity: "critical" | "high" | "medium" | "low";
  file: string;
  line: number;
  cwe: string;
  iso27001Control: string;
  iso27001ControlName: string;
  iso27001Description: string;
};

function mapSeverity(raw: string): Secret["severity"] {
  const s = raw?.toLowerCase();
  if (s === "critical") return "critical";
  if (s === "high") return "high";
  if (s === "medium") return "medium";
  return "low";
}

function extractRedactedMatch(description: string): string {
  const m = description.match(/\(matched: (.+)\)\s*$/);
  return m ? m[1] : "—";
}

function humanizeRuleId(rule: string): string {
  if (rule === "entropy-generic") return "High-Entropy String";
  return rule.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function normalize(data: BackendFinding[]): Secret[] {
  return data
    .filter((item) => item.scanner === "secrets")
    .map((item, index) => ({
      id: index + 1,
      type: humanizeRuleId(item.rule),
      ruleId: item.rule,
      redactedMatch: extractRedactedMatch(item.description),
      detectionMethod: item.rule === "entropy-generic" ? "entropy" : "pattern",
      severity: mapSeverity(item.severity),
      file: item.file || "unknown",
      line: item.line || 0,
      cwe: item.cwe || "CWE-798",
      iso27001Control: item.iso27001_control || "5.17",
      iso27001ControlName: item.iso27001_control_name || "Authentication information",
      iso27001Description: item.iso27001_description || "Allocation and management of authentication information shall be controlled by a management process, including advising personnel on appropriate handling of authentication information.",
    }));
}

const EXAMPLE_REPOS = [
  "https://github.com/pallets/flask",
  "https://github.com/django/django",
  "https://github.com/expressjs/express",
];

function SecretsPage() {
  const [scanMode, setScanMode] = useState<"github" | "local">("github");
  const [repoUrl, setRepoUrl] = useState("https://github.com/pallets/flask");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [secrets, setSecrets] = useState<Secret[]>([]);
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
    setSecrets([]);
    const startTime = Date.now();

    try {
      let response: Response;
      if (scanMode === "github") {
        response = await fetch(`${BACKEND_URL}/api/secrets/scan`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ repo_url: repoUrl.trim() }),
        });
      } else {
        const formData = new FormData();
        formData.append("file", selectedFile as File);
        response = await fetch(`${BACKEND_URL}/api/secrets/scan-local`, { method: "POST", body: formData });
      }

      if (!response.ok) throw new Error(`Backend error ${response.status}: ${await response.text()}`);
      const data: BackendFinding[] = await response.json();
      if (!Array.isArray(data)) throw new Error("Backend did not return an array of findings");

      setSecrets(normalize(data));
      setHasScanned(true);
      setScanTime(Math.round((Date.now() - startTime) / 1000));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setScanning(false);
    }
  };

  const counts = {
    critical: secrets.filter((s) => s.severity === "critical").length,
    high: secrets.filter((s) => s.severity === "high").length,
    medium: secrets.filter((s) => s.severity === "medium").length,
    low: secrets.filter((s) => s.severity === "low").length,
  };

  const filtered = secrets.filter((s) => activeTab === "all" || s.severity === activeTab);

  const reportFindings = secrets.map((s) => ({
    title: s.type, severity: s.severity, file: s.file, line: s.line,
    description: `Secret detected (matched: ${s.redactedMatch})`,
    rule: s.ruleId, cwe: s.cwe, owasp: "A02:2021", scanner: "secrets",
    iso27001_control: s.iso27001Control,
    iso27001_control_name: s.iso27001ControlName,
    iso27001_description: s.iso27001Description,
  }));

  return (
    <>
      <PageHeader
        eyebrow="Scanner · Secrets"
        title="Secrets Detection"
        description="Pattern + entropy-based detection of AWS keys, GitHub tokens, and credentials across your codebase."
        actions={
          <div className="flex flex-wrap gap-2">
            <ViewStandardLink />
            <ExportReportButton findings={reportFindings} scanType="secrets" repoLabel={scanMode === "github" ? repoUrl : selectedFile?.name || ""} />
          </div>
        }
      />

      <ScanControls
        scanMode={scanMode} setScanMode={setScanMode}
        repoUrl={repoUrl} setRepoUrl={setRepoUrl}
        selectedFile={selectedFile} setSelectedFile={setSelectedFile}
        onRun={runScan} scanning={scanning} error={error} scanTime={scanTime}
        exampleRepos={EXAMPLE_REPOS} runLabel="Run Secrets Scan"
      />

      {hasScanned && (
        <>
          <div className="mb-6 grid gap-4 md:grid-cols-4">
            <StatCard label="Critical" value={String(counts.critical)} tone="critical" icon={ShieldAlert} />
            <StatCard label="High" value={String(counts.high)} tone="warning" icon={AlertTriangle} />
            <StatCard label="Medium" value={String(counts.medium)} tone="info" icon={Info} />
            <StatCard label="Low" value={String(counts.low)} tone="info" icon={KeyRound} />
          </div>

          <Panel>
            <div className="mb-5 flex flex-wrap items-center gap-2">
              {[
                { key: "all", label: "All", count: secrets.length },
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
              <table className="w-full min-w-[920px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    <th className="px-6 py-3 font-medium">Secret Type</th>
                    <th className="px-3 py-3 font-medium">File · Line</th>
                    <th className="px-3 py-3 font-medium">Redacted Match</th>
                    <th className="px-3 py-3 font-medium">Detection</th>
                    <th className="px-3 py-3 font-medium">CWE</th>
                    <th className="px-3 py-3 font-medium">Severity</th>
                    <th className="px-6 py-3 font-medium">ISO 27001</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr><td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">No secrets for this filter.</td></tr>
                  )}
                  {filtered.map((s) => (
                    <tr key={s.id} className="border-b border-border/40 transition-colors hover:bg-secondary/40">
                      <td className="px-6 py-3 font-medium">{s.type}</td>
                      <td className="px-3 py-3 font-mono text-xs text-info" title={s.file}>{s.file}:{s.line}</td>
                      <td className="px-3 py-3 font-mono text-xs text-muted-foreground">{s.redactedMatch}</td>
                      <td className="px-3 py-3 text-xs text-muted-foreground">{s.detectionMethod === "entropy" ? "Entropy" : "Pattern match"}</td>
                      <td className="px-3 py-3 font-mono text-xs text-muted-foreground">{s.cwe}</td>
                      <td className="px-3 py-3"><SeverityBadge level={s.severity} /></td>
                      <td className="px-6 py-3">
                        <ISO27001Badge info={{ control: s.iso27001Control, controlName: s.iso27001ControlName, description: s.iso27001Description }} />
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
                ? "Enter a GitHub repository URL above and run a secrets scan to detect exposed credentials."
                : "Upload a .zip of your project above and run a secrets scan to detect exposed credentials."}
            </div>
          </div>
        </Panel>
      )}
    </>
  );
}
