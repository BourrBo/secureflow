import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Package, ShieldAlert, AlertTriangle, Info } from "lucide-react";
import { PageHeader, Panel, StatCard, SeverityBadge } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { ISO27001Badge, ViewStandardLink, ExportReportButton } from "@/components/dashboard/ISO27001";
import { ScanControls } from "@/components/dashboard/ScanControls";

export const Route = createFileRoute("/dashboard/sca")({ component: ScaPage });

const BACKEND_URL = "http://127.0.0.1:8000";

type BackendFinding = {
  title: string;
  severity: string; // Trivy: CRITICAL/HIGH/MEDIUM/LOW/UNKNOWN
  file: string;
  line: number;
  description: string;
  rule: string; // CVE-... / GHSA-...
  cwe: string;
  owasp: string;
  scanner: string; // only "trivy" rows are kept on this page
  installed_version?: string | null;
  fixed_version?: string | null;
  cvss?: number | null;
  ecosystem?: string | null;
  iso27001_control?: string;
  iso27001_control_name?: string;
  iso27001_description?: string;
};

type Dependency = {
  id: number;
  name: string;
  severity: "critical" | "high" | "medium" | "low";
  installedVersion: string;
  fixedVersion: string;
  cve: string;
  cvss: number | null;
  ecosystem: string;
  file: string;
  description: string;
  cwe: string;
  iso27001Control: string;
  iso27001ControlName: string;
  iso27001Description: string;
};

function mapSeverity(raw: string): Dependency["severity"] {
  const s = raw?.toUpperCase();
  if (s === "CRITICAL") return "critical";
  if (s === "HIGH") return "high";
  if (s === "MEDIUM") return "medium";
  return "low";
}

function normalize(data: BackendFinding[]): Dependency[] {
  return data
    .filter((item) => item.scanner === "trivy")
    .map((item, index) => ({
      id: index + 1,
      name: item.title || "Unknown Package",
      severity: mapSeverity(item.severity),
      installedVersion: item.installed_version || "—",
      fixedVersion: item.fixed_version || "No fix available",
      cve: item.rule || "—",
      cvss: item.cvss ?? null,
      ecosystem: item.ecosystem || "unknown",
      file: item.file || "unknown",
      description: item.description || "",
      cwe: item.cwe || "CWE-000",
      iso27001Control: item.iso27001_control || "8.8",
      iso27001ControlName: item.iso27001_control_name || "Management of technical vulnerabilities",
      iso27001Description: item.iso27001_description || "Information about technical vulnerabilities of information systems in use shall be obtained, the organization's exposure to such vulnerabilities shall be evaluated and appropriate measures shall be taken.",
    }));
}

const EXAMPLE_REPOS = [
  "https://github.com/pallets/flask",
  "https://github.com/django/django",
  "https://github.com/expressjs/express",
];

function ScaPage() {
  const [scanMode, setScanMode] = useState<"github" | "local">("github");
  const [repoUrl, setRepoUrl] = useState("https://github.com/pallets/flask");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dependencies, setDependencies] = useState<Dependency[]>([]);
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
    setDependencies([]);
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

      setDependencies(normalize(data));
      setHasScanned(true);
      setScanTime(Math.round((Date.now() - startTime) / 1000));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setScanning(false);
    }
  };

  const counts = {
    critical: dependencies.filter((d) => d.severity === "critical").length,
    high: dependencies.filter((d) => d.severity === "high").length,
    medium: dependencies.filter((d) => d.severity === "medium").length,
    low: dependencies.filter((d) => d.severity === "low").length,
  };

  const filtered = dependencies.filter((d) => activeTab === "all" || d.severity === activeTab);

  const reportFindings = dependencies.map((d) => ({
    title: d.name, severity: d.severity, file: d.file, line: 0,
    description: d.description, rule: d.cve, cwe: d.cwe, owasp: "A06:2021",
    scanner: "trivy",
    iso27001_control: d.iso27001Control,
    iso27001_control_name: d.iso27001ControlName,
    iso27001_description: d.iso27001Description,
    installed_version: d.installedVersion,
    fixed_version: d.fixedVersion,
    cvss: d.cvss,
    ecosystem: d.ecosystem,
  }));

  return (
    <>
      <PageHeader
        eyebrow="Scanner · SCA"
        title="Software Composition Analysis"
        description="Dependency scanning via Trivy — CVEs across your project's package manifests."
        actions={
          <div className="flex flex-wrap gap-2">
            <ViewStandardLink />
            <ExportReportButton findings={reportFindings} scanType="sca" repoLabel={scanMode === "github" ? repoUrl : selectedFile?.name || ""} />
          </div>
        }
      />

      <ScanControls
        scanMode={scanMode} setScanMode={setScanMode}
        repoUrl={repoUrl} setRepoUrl={setRepoUrl}
        selectedFile={selectedFile} setSelectedFile={setSelectedFile}
        onRun={runScan} scanning={scanning} error={error} scanTime={scanTime}
        exampleRepos={EXAMPLE_REPOS} runLabel="Run SCA Scan"
      />

      {hasScanned && (
        <>
          <div className="mb-6 grid gap-4 md:grid-cols-4">
            <StatCard label="Critical" value={String(counts.critical)} tone="critical" icon={ShieldAlert} />
            <StatCard label="High" value={String(counts.high)} tone="warning" icon={AlertTriangle} />
            <StatCard label="Medium" value={String(counts.medium)} tone="info" icon={Info} />
            <StatCard label="Low" value={String(counts.low)} tone="info" icon={Package} />
          </div>

          <Panel>
            <div className="mb-5 flex flex-wrap items-center gap-2">
              {[
                { key: "all", label: "All", count: dependencies.length },
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
                    <th className="px-6 py-3 font-medium">Package</th>
                    <th className="px-3 py-3 font-medium">Ecosystem</th>
                    <th className="px-3 py-3 font-medium">Installed</th>
                    <th className="px-3 py-3 font-medium">Fix In</th>
                    <th className="px-3 py-3 font-medium">CVE</th>
                    <th className="px-3 py-3 font-medium">CVSS</th>
                    <th className="px-3 py-3 font-medium">Severity</th>
                    <th className="px-6 py-3 font-medium">ISO 27001</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr><td colSpan={8} className="px-6 py-12 text-center text-muted-foreground">No dependency vulnerabilities for this filter.</td></tr>
                  )}
                  {filtered.map((d) => (
                    <tr key={d.id} className="border-b border-border/40 transition-colors hover:bg-secondary/40">
                      <td className="px-6 py-3 font-medium">{d.name}</td>
                      <td className="px-3 py-3 font-mono text-xs text-muted-foreground">{d.ecosystem}</td>
                      <td className="px-3 py-3 font-mono text-xs text-muted-foreground">{d.installedVersion}</td>
                      <td className="px-3 py-3 font-mono text-xs text-success">{d.fixedVersion}</td>
                      <td className="px-3 py-3 font-mono text-xs text-info">{d.cve}</td>
                      <td className="px-3 py-3 font-mono text-xs text-muted-foreground">{d.cvss ?? "—"}</td>
                      <td className="px-3 py-3"><SeverityBadge level={d.severity} /></td>
                      <td className="px-6 py-3">
                        <ISO27001Badge info={{ control: d.iso27001Control, controlName: d.iso27001ControlName, description: d.iso27001Description }} />
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
                ? "Enter a GitHub repository URL above and run an SCA scan to detect vulnerable dependencies with Trivy."
                : "Upload a .zip of your project above and run an SCA scan to detect vulnerable dependencies with Trivy."}
            </div>
          </div>
        </Panel>
      )}
    </>
  );
}
