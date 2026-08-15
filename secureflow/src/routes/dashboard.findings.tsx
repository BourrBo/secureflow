import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader, Panel, StatCard } from "@/components/dashboard/primitives";
import { FindingsTable } from "@/components/dashboard/FindingsTable";
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
import { api } from "@/lib/api";
import {
  countBySeverity,
  MODULE_LABEL,
  normalizeFinding,
  type Finding,
  type Severity,
} from "@/lib/security";
import { Bug, ShieldAlert, AlertTriangle, Search, Download, Trash2, Loader2 } from "lucide-react";

const PAGE_SIZE = 25;

export const Route = createFileRoute("/dashboard/findings")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === "string" ? search.q : "",
  }),
  component: Findings,
});

const FILTERS: Array<{ label: string; value: Severity | "all" }> = [
  { label: "All", value: "all" },
  { label: "Critical", value: "critical" },
  { label: "High", value: "high" },
  { label: "Medium", value: "medium" },
  { label: "Low", value: "low" },
];

function Findings() {
  const { q: initialQ } = Route.useSearch();
  const [severity, setSeverity] = useState<Severity | "all">("all");
  const [inputValue, setInputValue] = useState(initialQ ?? "");
  const [q, setQ] = useState(initialQ ?? "");
  const [page, setPage] = useState(0);
  const [clearing, setClearing] = useState(false);
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery(
    findingsPageQuery(PAGE_SIZE, page * PAGE_SIZE, q || undefined),
  );

  useEffect(() => {
    const timer = setTimeout(() => setQ(inputValue), 350);
    return () => clearTimeout(timer);
  }, [inputValue]);

  useEffect(() => {
    setPage(0);
  }, [q, severity]);

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
      for (const key of [
        "findings",
        "findings-page",
        "projects",
        "project-scans",
        "reports",
        "compliance",
        "gate-runs",
      ]) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
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
        title="All findings"
        description="Every open issue across every module, ranked by severity and recency."
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
    </>
  );
}
