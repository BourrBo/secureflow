import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Panel } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { FileText, Download } from "lucide-react";

export const Route = createFileRoute("/dashboard/reports")({ component: Reports });

const reports = [
  { name: "Weekly security summary", date: "Jul 05, 2026", type: "PDF", size: "412 KB" },
  { name: "SBOM · api-gateway (CycloneDX)", date: "Jul 04, 2026", type: "JSON", size: "1.2 MB" },
  { name: "SBOM · billing-svc (SPDX)", date: "Jul 04, 2026", type: "JSON", size: "890 KB" },
  { name: "SOC 2 evidence pack", date: "Jul 01, 2026", type: "ZIP", size: "8.4 MB" },
  { name: "Q2 2026 executive brief", date: "Jun 30, 2026", type: "PDF", size: "2.1 MB" },
];

function Reports() {
  return (
    <>
      <PageHeader eyebrow="Workspace" title="Reports & exports" description="SBOMs, executive summaries, compliance evidence — generated automatically."
        actions={<Button variant="hero" size="sm">Generate report</Button>} />
      <Panel>
        <ul className="divide-y divide-border/60">
          {reports.map((r) => (
            <li key={r.name} className="flex items-center gap-4 py-4 first:pt-0 last:pb-0">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><FileText className="h-4 w-4" /></div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{r.name}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{r.date} · {r.type} · {r.size}</div>
              </div>
              <Button variant="ghost" size="sm"><Download className="h-3.5 w-3.5" /> Download</Button>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}