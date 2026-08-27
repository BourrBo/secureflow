import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { clearOrganizationState } from "@/lib/organization";
import { useScanResults } from "@/lib/scanResults";
import { PageHeader, Panel, StatCard } from "@/components/dashboard/primitives";
import { FindingsTable } from "@/components/dashboard/FindingsTable";
import { FindingDetailDialog } from "@/components/dashboard/FindingDetailDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { findingsPageQuery } from "@/lib/queries";
import { api, type FindingStatus } from "@/lib/api";
import {
  countBySeverity,
  MODULE_LABEL,
  MODULE_TO_ENGINE,
  normalizeFinding,
  type Finding,
  type ModuleKey,
  type Severity,
} from "@/lib/security";
import { Bug, ShieldAlert, AlertTriangle, Search, Download, Trash2, Loader2 } from "lucide-react";

const PAGE_SIZE = 25;

export const Route = createFileRoute("/dashboard/findings")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === "string" ? search.q : "",
    // Explicit scope IDs — a project's "View findings" action must never
    // silently fall back to every project in the workspace.
    project_id:
      typeof search.project_id === "string" && search.project_id ? search.project_id : undefined,
    scan_id: typeof search.scan_id === "string" && search.scan_id ? search.scan_id : undefined,
  }),
  component: Findings,
});

const MODULE_FILTERS: Array<{ label: string; value: ModuleKey | "all" }> = [
  { label: "All scanners", value: "all" },
  ...(Object.keys(MODULE_LABEL) as ModuleKey[]).map((m) => ({ label: MODULE_LABEL[m], value: m })),
];

const STATUS_FILTERS: Array<{ label: string; value: FindingStatus | "all" }> = [
  { label: "All", value: "all" },
  { label: "Open", value: "Open" },
  { label: "Triaged", value: "Triaged" },
  { label: "Fixed", value: "Fixed" },
  { label: "Accepted", value: "Accepted" },
];

const FILTERS: Array<{ label: string; value: Severity | "all" }> = [
  { label: "All", value: "all" },
  { label: "Critical", value: "critical" },
  { label: "High", value: "high" },
  { label: "Medium", value: "medium" },
  { label: "Low", value: "low" },
];

function Findings() {
  const { q: initialQ, project_id: projectId, scan_id: scanId } = Route.useSearch();
  const navigate = useNavigate();
  const [severity, setSeverity] = useState<Severity | "all">("all");
  // Scanner scoping is a server-side filter: the table then renders that
  // scanner's own column schema instead of a lowest-common-denominator row.
  const [module, setModule] = useState<ModuleKey | "all">("all");
  // Lifecycle triage state is a real server-side filter, not a client slice.
  const [status, setStatus] = useState<FindingStatus | "all">("all");
  const [inputValue, setInputValue] = useState(initialQ ?? "");
  const [q, setQ] = useState(initialQ ?? "");
  const [page, setPage] = useState(0);
  const [clearing, setClearing] = useState(false);
  const [detail, setDetail] = useState<Finding | null>(null);
  const queryClient = useQueryClient();
  const { clearAll: clearScanResults } = useScanResults();
  const { data, isLoading, error } = useQuery(
    findingsPageQuery(PAGE_SIZE, page * PAGE_SIZE, {
      q: q || undefined,
      project_id: projectId,
      scan_id: scanId,
      scanner: module === "all" ? undefined : MODULE_TO_ENGINE[module],
      status: status === "all" ? undefined : status,
    }),
  );

  useEffect(() => {
    const timer = setTimeout(() => setQ(inputValue), 350);
    return () => clearTimeout(timer);
  }, [inputValue]);

  useEffect(() => {
    setPage(0);
  }, [q, severity, module, status, projectId, scanId]);

  const all = useMemo(() => data?.items ?? [], [data]);
  const total = data?.total ?? all.length;
  const counts = useMemo(() => countBySeverity(all), [all]);
  const rows = useMemo(
    () => all.filter((f) => severity === "all" || f.severity === severity),
    [all, severity],
  );

  const modules = useMemo(() => {
    const set = new Set(all.map((f) => f.module).filter(Boolean));
    return [...set].map((m) => MODULE_LABEL[m!]);
  }, [all]);

  const dash = isLoading || error ? "—" : undefined;

  async function clearWorkspace() {
    setClearing(true);
    try {
      const r = await api.clearWorkspace();
      const parts = [
        `${r.findings ?? r.deleted ?? 0} findings`,
        `${r.scans ?? 0} scans`,
        `${r.projects ?? 0} projects`,
      ];
      toast.success(`Workspace cleared — deleted ${parts.join(", ")}`);
      // A true fresh start: every project/scan/finding the cache knew about
      // is gone on the backend, so drop the whole cache rather than a
      // hand-maintained key list. The next created records get whatever IDs
      // the backend assigns — nothing here assumes they restart at 1.
      queryClient.clear();
      clearScanResults();
      // No scoped filters, selected organization or stored scan output may
      // survive — a refresh has to come back genuinely empty.
      clearOrganizationState();
      setInputValue("");
      setQ("");
      setModule("all");
      setSeverity("all");
      setStatus("all");
      setPage(0);
      setDetail(null);
      navigate({
        to: "/dashboard/findings",
        search: { q: "", project_id: undefined, scan_id: undefined },
        replace: true,
      });
      await queryClient.refetchQueries({ type: "active" });
    } catch (e) {
      toast.error("Could not clear workspace", {
        description: e instanceof Error ? e.message : "Unexpected error.",
      });
    } finally {
      setClearing(false);
    }
  }

  const [exporting, setExporting] = useState(false);

  function csvEscape(value: unknown): string {
    const text = value === null || value === undefined ? "" : String(value);
    if (text.includes(",") || text.includes('"') || text.includes("\n") || text.includes("\r")) {
      return '"' + text.replace(/"/g, '""') + '"';
    }
    return text;
  }

  function findingsToCsv(findings: Finding[]): string {
    const headers = [
      "id",
      "title",
      "severity",
      "scanner",
      "project",
      "file",
      "line",
      "cwe",
      "owasp",
      "iso27001_control",
      "cve",
      "epss_score",
      "priority_score",
      "status",
      "owner",
      "notes",
      "created_at",
    ];
    const rows = findings.map((f) => [
      f.id,
      f.title,
      f.severity,
      f.moduleLabel,
      f.project,
      f.file,
      f.line,
      f.cwe,
      f.owasp,
      f.iso?.control ?? "",
      f.cve,
      f.epssScore,
      f.priorityScore,
      f.status,
      f.owner,
      f.notes,
      f.createdAt ? f.createdAt.toISOString() : "",
    ]);
    return [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
  }

  async function handleExport() {
    if (exporting) return;
    setExporting(true);
    try {
      const r = await api.listFindings({
        q: q || undefined,
        project_id: projectId,
        scan_id: scanId,
        scanner: module === "all" ? undefined : MODULE_TO_ENGINE[module],
        status: status === "all" ? undefined : status,
        severity:
          severity !== "all"
            ? (severity.toUpperCase() as "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO")
            : undefined,
        limit: undefined,
      });
      const list = Array.isArray(r) ? r : (r?.findings ?? []);
      if (list.length === 0) {
        toast("No findings to export");
        return;
      }
      const findings = list.map((f, i) => normalizeFinding(f, i));
      const csv = findingsToCsv(findings);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `secureflow-findings-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${findings.length} findings`);
    } catch (e) {
      toast.error("Could not export findings", {
        description: e instanceof Error ? e.message : "Unexpected error.",
      });
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Workspace · Findings"
        title={projectId ? "Project findings" : "All findings"}
        description={
          projectId
            ? "Findings for this project only — the same rows the scan result screens show."
            : "Every open issue across every module, ranked by severity and recency."
        }
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={exporting} onClick={handleExport}>
              {exporting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              Export
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={clearing}>
                  {clearing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                  Clear workspace
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reset this workspace?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently deletes all findings ({total.toLocaleString()} rows), scan
                    history, and projects in your workspace. Reports generated from this data cannot
                    be recovered.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={clearWorkspace}>
                    Yes, delete everything
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        }
      />
      <div className="grid gap-3 md:grid-cols-4">
        <StatCard
          label="Total open"
          value={dash ?? total.toLocaleString()}
          tone="warning"
          icon={Bug}
          loading={isLoading}
        />
        <StatCard
          label="Critical"
          value={dash ?? counts.critical}
          tone="critical"
          icon={ShieldAlert}
          loading={isLoading}
        />
        <StatCard
          label="High"
          value={dash ?? counts.high}
          tone="warning"
          icon={AlertTriangle}
          loading={isLoading}
        />
        <StatCard
          label="Modules reporting"
          value={dash ?? modules.length}
          tone="info"
          loading={isLoading}
          hint={modules.join(" · ") || undefined}
        />
      </div>
      <Panel className="mt-5">
        {(projectId || scanId) && (
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-[12px]">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Scoped to
            </span>
            {projectId && <span className="font-mono">project #{projectId}</span>}
            {scanId && <span className="font-mono">· scan #{scanId}</span>}
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-7 text-[11px]"
              onClick={() =>
                navigate({
                  to: "/dashboard/findings",
                  search: { q, project_id: undefined, scan_id: undefined },
                })
              }
            >
              View all findings
            </Button>
          </div>
        )}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Search title, CVE, CWE, rule, file, project or module…"
              className="h-9 pl-9 text-[13px]"
            />
            {inputValue && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => {
                  setInputValue("");
                  setQ("");
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border/70 bg-secondary/20 p-1">
            {MODULE_FILTERS.map((m) => (
              <button
                key={m.value}
                onClick={() => setModule(m.value)}
                className={`rounded-md px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors ${
                  module === m.value
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-border/70 bg-secondary/20 p-1">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s.value}
                onClick={() => setStatus(s.value)}
                className={`rounded-md px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors ${
                  status === s.value
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-border/70 bg-secondary/20 p-1">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setSeverity(f.value)}
                className={`rounded-md px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors ${
                  severity === f.value
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <FindingsTable
          findings={rows}
          isLoading={isLoading}
          error={error}
          detailed
          module={module === "all" ? null : module}
          onView={setDetail}
          emptyTitle={all.length === 0 ? "No findings yet" : "No matches"}
          emptyDescription={
            all.length === 0
              ? "Connect a repository and run your first scan — results land here automatically."
              : "Try a different search term or severity filter."
          }
        />
        {!isLoading && !error && all.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] text-muted-foreground">
              Showing {(page * PAGE_SIZE + 1).toLocaleString()}–
              {(page * PAGE_SIZE + all.length).toLocaleString()} of {total.toLocaleString()}{" "}
              findings
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Prev
              </Button>
              <span className="px-2 text-[11px] text-muted-foreground">
                Page {page + 1} of {Math.max(1, Math.ceil(total / PAGE_SIZE))}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page * PAGE_SIZE + all.length >= total}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Panel>
      <FindingDetailDialog finding={detail} onOpenChange={(open) => !open && setDetail(null)} />
    </>
  );
}
