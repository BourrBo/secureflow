import { useState } from "react";
import { FileText, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";

export type ISO27001Info = {
  control: string;        // e.g. "8.28"
  controlName: string;    // e.g. "Secure coding"
  description: string;    // full Annex A control text
};

const BACKEND_URL = "http://127.0.0.1:8000";

// ── Small inline badge for table rows — click opens the full control card ──
export function ISO27001Badge({ info }: { info: ISO27001Info }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="View ISO/IEC 27001 Annex A control"
        className="inline-flex items-center rounded-md border border-success/30 bg-success/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-success transition-colors hover:bg-success/20"
      >
        A.{info.control}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="font-mono text-[10px] uppercase tracking-widest text-accent">
              ISO/IEC 27001:2022 — Annex A
            </div>
            <DialogTitle className="mt-1">
              {info.control} &nbsp;{info.controlName}
            </DialogTitle>
          </DialogHeader>

          <div>
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Control
            </div>
            <DialogDescription className="text-sm leading-relaxed text-foreground/80">
              {info.description}
            </DialogDescription>
          </div>

          <DialogFooter className="items-center sm:justify-between">
            <span className="text-xs text-muted-foreground">Table A.1 — Information security controls</span>
            <a
              href="/docs/ISO_IEC_27001_2022.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-info hover:underline"
            >
              Open full standard (PDF) →
            </a>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Page-level link to the full standard document ──
export function ViewStandardLink() {
  return (
    <Button variant="outline" size="sm" asChild>
      <a href="/docs/ISO_IEC_27001_2022.pdf" target="_blank" rel="noopener noreferrer">
        <FileText className="h-3.5 w-3.5" />
        ISO/IEC 27001:2022
      </a>
    </Button>
  );
}

// ── Calls the backend to build an ISO/IEC 27001-styled PDF report and downloads it ──
export async function exportISOReport(
  findings: any[],
  scanType: "sast" | "sca" | "iac" | "secrets" | "all" | "container",
  repoLabel: string,
) {
  const response = await fetch(`${BACKEND_URL}/api/reports/pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ findings, scan_type: scanType, repo_label: repoLabel }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Report generation failed: ${response.status} — ${text}`);
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `secureflow_${scanType}_iso27001_report.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

// ── Button that triggers the export above, with a loading state ──
export function ExportReportButton({
  findings, scanType, repoLabel,
}: {
  findings: any[];
  scanType: "sast" | "sca" | "iac" | "secrets" | "all" | "container";
  repoLabel: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    if (!findings.length || busy) return;
    setBusy(true);
    setError(null);
    try {
      await exportISOReport(findings, scanType, repoLabel);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={handleClick}
        disabled={!findings.length || busy}
        title={findings.length ? "Export findings as an ISO/IEC 27001-formatted PDF report" : "Run a scan first"}
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
        {busy ? "Generating…" : "Export ISO Report"}
      </Button>
      {error && (
        <div className="absolute left-0 top-full z-10 mt-1 whitespace-nowrap rounded-md border border-critical/30 bg-popover px-2 py-1 text-[10px] text-critical shadow-md">
          {error}
        </div>
      )}
    </div>
  );
}
