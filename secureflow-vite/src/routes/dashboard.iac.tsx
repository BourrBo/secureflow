import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Boxes, ShieldAlert, AlertTriangle, Info } from "lucide-react";
import { PageHeader, Panel, StatCard, SeverityBadge } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { ISO27001Badge, ViewStandardLink, ExportReportButton } from "@/components/dashboard/ISO27001";
import { ScanControls } from "@/components/dashboard/ScanControls";

export const Route = createFileRoute("/dashboard/iac")({ component: IacPage });

const BACKEND_URL = "http://127.0.0.1:8000";

interface Finding {
  title: string;
  severity: string; // CRITICAL/HIGH/MEDIUM/LOW/INFO
  file: string;
  line: number;
  description: string;
  rule: string;
  cwe: string;
  owasp: string;
  scanner: string;
  iso27001_control?: string;
  iso27001_control_name?: string;
  iso27001_description?: string;
}

function toSevKey(s: string): "critical" | "high" | "medium" | "low" {
  const up = s?.toUpperCase();
  if (up === "CRITICAL") return "critical";
  if (up === "HIGH") return "high";
  if (up === "MEDIUM") return "medium";
  return "low";
}

function guessCategory(file: string): string {
  const f = file.toLowerCase();
  if (f.includes("k8s") || f.endsWith(".yaml") || f.endsWith(".yml")) return "K8s";
  if (f.includes("docker")) return "Docker";
  if (f.includes("helm")) return "Helm";
  if (f.includes("terraform") || f.endsWith(".tf")) return "Terraform";
  if (f.includes("iam")) return "IAM";
  if (f.includes("cloudformation") || f.endsWith(".json")) return "CloudFormation";
  return "IaC";
}

const EXAMPLE_REPOS = [
  "https://github.com/pallets/flask",
  "https://github.com/django/django",
  "https://github.com/expressjs/express",
];

function IacPage() {
  const [scanMode, setScanMode] = useState<"github" | "local">("github");
  const [repoUrl, setRepoUrl] = useState("");
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
      let res: Response;
      if (scanMode === "github") {
        res = await fetch(`${BACKEND_URL}/api/iac/scan`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ repo_url: repoUrl.trim() }),
        });
      } else {
        const form = new FormData();
        form.append("file", selectedFile as File);
        res = await fetch(`${BACKEND_URL}/api/iac/scan-local`, { method: "POST", body: form });
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail ?? `HTTP ${res.status}`);
      }
      const data: Finding[] = await res.json();
      setFindings(Array.isArray(data) ? data : []);
      setHasScanned(true);
      setScanTime(Math.round((Date.now() - startTime) / 1000));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  };

  const counts = {
    critical: findings.filter((f) => toSevKey(f.severity) === "critical").length,
    high: findings.filter((f) => toSevKey(f.severity) === "high").length,
    medium: findings.filter((f) => toSevKey(f.severity) === "medium").length,
    low: findings.filter((f) => toSevKey(f.severity) === "low").length,
  };

  const filtered = findings.filter((f) => activeTab === "all" || toSevKey(f.severity) === activeTab);

  const reportFindings = findings.map((f) => ({
    title: f.title, severity: f.severity, file: f.file, line: f.line,
    description: f.description, rule: f.rule, cwe: f.cwe, owasp: f.owasp,
    scanner: "checkov",
    iso27001_control: f.iso27001_control,
    iso27001_control_name: f.iso27001_control_name,
    iso27001_description: f.iso27001_description,
  }));

  return (
    <>
      <PageHeader
        eyebrow="Scanner · IaC"
        title="Infrastructure as Code Security"
        description="Scan Terraform, Helm, Kubernetes and CloudFormation with Checkov before infrastructure is provisioned."
        actions={
          <div className="flex flex-wrap gap-2">
            <ViewStandardLink />
            <ExportReportButton findings={reportFindings} scanType="iac" repoLabel={scanMode === "github" ? repoUrl : selectedFile?.name || ""} />
          </div>
        }
      />

      <ScanControls
        scanMode={scanMode} setScanMode={setScanMode}
        repoUrl={repoUrl} setRepoUrl={setRepoUrl}
        selectedFile={selectedFile} setSelectedFile={setSelectedFile}
        onRun={runScan} scanning={scanning} error={error} scanTime={scanTime}
        exampleRepos={EXAMPLE_REPOS} runLabel="Run IaC Scan"
      />

      {hasScanned && (
        <>
          <div className="mb-6 grid gap-4 md:grid-cols-4">
            <StatCard label="Critical" value={String(counts.critical)} tone="critical" icon={ShieldAlert} />
            <StatCard label="High" value={String(counts.high)} tone="warning" icon={AlertTriangle} />
            <StatCard label="Medium" value={String(counts.medium)} tone="info" icon={Info} />
            <StatCard label="Low" value={String(counts.low)} tone="info" icon={Boxes} />
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
              <table className="w-full min-w-[920px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    <th className="px-6 py-3 font-medium">Check ID / Rule</th>
                    <th className="px-3 py-3 font-medium">Description</th>
                    <th className="px-3 py-3 font-medium">File · Line</th>
                    <th className="px-3 py-3 font-medium">Category</th>
                    <th className="px-3 py-3 font-medium">CWE</th>
                    <th className="px-3 py-3 font-medium">Severity</th>
                    <th className="px-6 py-3 font-medium">ISO 27001</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr><td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">No findings for this filter.</td></tr>
                  )}
                  {filtered.map((f, i) => (
                    <tr key={i} className="border-b border-border/40 transition-colors hover:bg-secondary/40">
                      <td className="px-6 py-3 font-mono text-xs">{f.rule || f.title}</td>
                      <td className="px-3 py-3 max-w-xs truncate text-xs text-muted-foreground" title={f.description}>{f.description}</td>
                      <td className="px-3 py-3 font-mono text-xs text-info" title={f.file}>{f.file}:{f.line}</td>
                      <td className="px-3 py-3 text-xs text-muted-foreground">{guessCategory(f.file)}</td>
                      <td className="px-3 py-3 font-mono text-xs text-muted-foreground">{f.cwe}</td>
                      <td className="px-3 py-3"><SeverityBadge level={toSevKey(f.severity)} /></td>
                      <td className="px-6 py-3">
                        <ISO27001Badge info={{
                          control: f.iso27001_control || "8.9",
                          controlName: f.iso27001_control_name || "Configuration management",
                          description: f.iso27001_description || "Configurations, including security configurations, of hardware, software, services and networks shall be established, documented, implemented, monitored and reviewed.",
                        }} />
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
                ? "Enter a GitHub repository URL above and run an IaC scan to detect misconfigurations with Checkov."
                : "Upload a .zip of your project above and run an IaC scan to detect misconfigurations with Checkov."}
            </div>
          </div>
        </Panel>
      )}
    </>
  );
}
