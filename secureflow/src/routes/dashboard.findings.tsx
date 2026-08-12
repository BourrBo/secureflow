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
import { countBySeverity, MODULE_LABEL, type Severity } from "@/lib/security";
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
  const [q, setQ] = useState(initialQ ?? "");
  const [page, setPage] = useState(0);
  const [clearing, setClearing] = useState(false);
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery(findingsPageQuery(PAGE_SIZE, page * PAGE_SIZE));

  useEffect(() => {
    setPage(0);
  }, [q, severity]);

  const all = useMemo(() => data?.items ?? [], [data]);
  const total = data?.total ?? all.length;
  const counts = useMemo(() => countBySeverity(all), [all]);
  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return all.filter(
      (f) =>
        (severity === "all" || f.severity === severity) &&
        (!term ||
          f.title.toLowerCase().includes(term) ||
          f.id.toLowerCase().includes(term) ||
          f.project.toLowerCase().includes(term) ||
          f.moduleLabel.toLowerCase().includes(term)),
    );
  }, [all, severity, q]);

  const modules = useMemo(() => {
    const set = new Set(all.map((f) => f.module).filter(Boolean));
    return [...set].map((m) => MODULE_LABEL[m!]);
  }, [all]);

  const dash = isLoading || error ? "—" : undefined;

  async function clearFindings() {
    setClearing(true);
    try {
      const r = await api.clearFindings();
      toast.success(`Cleared ${r.deleted} findings`);
      await queryClient.invalidateQueries({ queryKey: ["findings-page"] });
      await queryClient.invalidateQueries({ queryKey: ["findings"] });
    } catch (e) {
      toast.error("Could not clear findings", {
        description: e instanceof Error ? e.message : "Unexpected error.",
      });
    } finally {
      setClearing(false);
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
            <Button variant="outline" size="sm">
              <Download className="h-3.5 w-3.5" /> Export
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={clearing}>
                  {clearing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                  Clear findings
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete every stored finding?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently removes all persisted findings from the workspace database (
                    {total.toLocaleString()} rows). Scan history and reports generated from these
                    findings cannot be recovered.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={clearFindings}>
                    Yes, delete all findings
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
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by ID, title, project or module…"
              className="h-9 pl-9 text-[13px]"
            />
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
              {(page * PAGE_SIZE + all.length).toLocaleString()} of {total.toLocaleString()} findings
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
