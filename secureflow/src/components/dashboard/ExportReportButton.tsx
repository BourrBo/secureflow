import { useState } from "react";
import { toast } from "sonner";
import { api, type ApiFinding } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";

/** Shapes a raw backend finding into the ISO-report payload the API expects. */
function toReportFinding(f: ApiFinding): Record<string, unknown> {
  return {
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
