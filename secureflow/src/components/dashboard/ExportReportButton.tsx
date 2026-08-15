import { useState } from "react";
import { toast } from "sonner";
import { api, type ApiFinding } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";

/** Passes a value through only when the backend actually supplied one. */
function put(out: Record<string, unknown>, key: string, value: unknown) {
  if (value === undefined || value === null || value === "") return;
  out[key] = value;
}

/**
 * Shapes a raw backend finding into the ISO-report payload the API expects.
 * Every report-relevant field present on the finding is forwarded verbatim —
 * nothing is synthesized, and absent fields are simply omitted so the report
 * service can decide what "N/A" means.
 */
function toReportFinding(f: ApiFinding): Record<string, unknown> {
  const out: Record<string, unknown> = {
    title: f.title ?? f.message ?? f.description ?? f.rule_id ?? "Untitled finding",
    severity: f.severity ?? "INFO",
    file: (f.file as unknown) ?? f.file_path ?? "",
    line: f.line ?? null,
    description: f.description ?? f.message ?? "",
    rule: (f.rule as unknown) ?? f.rule_id ?? "",
    cwe: f.cwe ?? "",
    owasp: f.owasp ?? "",
    scanner: f.scanner ?? "",
    iso27001_control: f.iso27001_control ?? "",
    iso27001_control_name: f.iso27001_control_name ?? "",
    iso27001_description: f.iso27001_description ?? "",
  };

  // Vulnerability identity / scoring (SCA + container findings carry these).
  put(out, "cve", f.cve);
  put(out, "cvss", f.cvss);
  put(out, "cvss_vector", f["cvss_vector"]);
  put(out, "epss_score", f.epss_score);
  put(out, "epss_percentile", f.epss_percentile);
  put(out, "epss_risk_level", f["epss_risk_level"]);
  put(out, "priority_score", f.priority_score);
  put(out, "priority_basis", f.priority_basis);
  put(out, "priority_risk_level", f.priority_risk_level);

  // Package / dependency context.
  put(out, "ecosystem", f.ecosystem);
  put(out, "installed_version", f.installed_version);
  put(out, "fixed_version", f.fixed_version);
  put(out, "package_name", f["package_name"]);

  // Location details (DAST and IaC use these).
  put(out, "affected_location", f["affected_location"]);
  put(out, "affected_path", f["affected_path"]);
  put(out, "affected_parameter", f["affected_parameter"]);

  // Remediation + audit metadata.
  put(out, "recommendation", f.recommendation);
  put(out, "references", f.references);
  put(out, "additional_observations", f["additional_observations"]);
  put(out, "revalidation_status", f["revalidation_status"]);
  put(out, "new_or_repeat", f["new_or_repeat"]);
  put(out, "code_context", f.code_context);
  put(out, "rule_id", f.rule_id);
  put(out, "id", f.id);

  return out;
}

export function ExportReportButton({
  findings,
  scanType,
  repoLabel,
  label = "Export report",
}: {
  findings: ApiFinding[];
  scanType: string;
  repoLabel: string;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const ready = findings.length > 0;

  async function download() {
    if (!ready) return;
    setBusy(true);
    try {
      const blob = await api.reportPdfFromFindings({
        findings: findings.map(toReportFinding),
        scan_type: scanType,
        repo_label: repoLabel,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `secureflow-${scanType}-report.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Report downloaded");
    } catch (e) {
      toast.error("Export failed", {
        description: e instanceof Error ? e.message : "Unexpected error.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={!ready || busy}
      onClick={download}
      title={ready ? `Export ${findings.length} findings` : "Run a scan first"}
    >
      {busy ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Download className="h-3.5 w-3.5" />
      )}
      {label}
    </Button>
  );
}
