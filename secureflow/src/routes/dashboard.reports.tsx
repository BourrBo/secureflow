import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader, Panel, EmptyState, ErrorState } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { projectsQuery } from "@/lib/queries";
import { api } from "@/lib/api";
import { normalizeScan } from "@/lib/security";
import { FileText, Download, FolderGit2, Loader2 } from "lucide-react";

export const Route = createFileRoute("/dashboard/reports")({ component: Reports });

function Reports() {
  const { data, isLoading, error } = useQuery(projectsQuery());
  const [busyId, setBusyId] = useState<string | null>(null);

  async function download(projectId: string, projectName: string) {
    setBusyId(projectId);
    try {
      const r = await api.getProjectScans(projectId);
      const list = (Array.isArray(r) ? r : (r?.scans ?? [])).map(normalizeScan);
      const completed = list
        .filter((s) => s.status.toLowerCase() === "completed")
        .sort((a, b) => (b.at?.getTime() ?? 0) - (a.at?.getTime() ?? 0));
      const latest = completed[0];
      if (!latest) {
        toast.error("No completed scan to generate a report from — run a scan first");
        return;
      }
      const blob = await api.reportPdf(latest.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `secureflow-${projectName.replace(/[^a-z0-9-_]+/gi, "-")}-report.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Report downloaded");
    } catch (e) {
      toast.error("Download failed", {
        description: e instanceof Error ? e.message : "Unexpected error.",
      });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Workspace"
        title="Reports & exports"
        description="Generate SBOMs, executive summaries and compliance evidence from your live scan data."
        actions={
          <Button asChild variant="hero" size="sm">
            <Link to="/dashboard/projects">Choose a project</Link>
          </Button>
        }
      />
      <Panel title="Available exports" description="One export set per connected project">
        {error ? (
          <ErrorState error={error} />
        ) : isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-lg" />
            ))}
          </div>
        ) : (data?.length ?? 0) === 0 ? (
          <EmptyState
            icon={FolderGit2}
            title="Nothing to export yet"
            description="Connect a repository and run a scan — SBOMs and summary reports become available here."
          />
        ) : (
          <ul className="divide-y divide-border/60">
            {data!.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium">SBOM · {p.name}</div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    CycloneDX / SPDX · branch {p.branch}
                    {p.scans !== null ? ` · ${p.scans} scans` : ""}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busyId !== null}
                  onClick={() => download(String(p.id), p.name)}
                >
                  {busyId === String(p.id) ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )}{" "}
                  Download
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
