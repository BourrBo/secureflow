import { memo, useMemo } from "react";
import { EmptyState, ErrorState, SeverityBadge, TableSkeleton } from "./primitives";
import { MIXED_COLUMNS, MODULE_COLUMNS, Mono, pruneColumns, uniformModule } from "./findingColumns";
import { Button } from "@/components/ui/button";
import { relativeTime, SEVERITY_ORDER, type Finding, type ModuleKey } from "@/lib/security";
import { ShieldCheck } from "lucide-react";

function bySeverityThenDate(a: Finding, b: Finding) {
  const d = SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity);
  if (d !== 0) return d;
  return (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0);
}

export const FindingsTable = memo(function FindingsTable({
  findings,
  isLoading,
  error,
  limit,
  showProject = true,
  showModule = true,
  detailed = false,
  module,
  onView,
  emptyTitle = "No findings",
  emptyDescription,
}: {
  findings?: Finding[];
  isLoading?: boolean;
  error?: unknown;
  limit?: number;
  showProject?: boolean;
  showModule?: boolean;
  /**
   * Consolidated view: renders the scanner-specific schema (the same column
   * definitions the module scan tables use) instead of a summary row.
   */
  detailed?: boolean;
  /** Forces a scanner schema; otherwise it is inferred from the rows. */
  module?: ModuleKey | null;
  onView?: (finding: Finding) => void;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  const rows = useMemo(
    () => [...(findings ?? [])].sort(bySeverityThenDate).slice(0, limit ?? undefined),
    [findings, limit],
  );

  const active = module ?? uniformModule(rows);
  const cols = useMemo(
    () => (detailed ? pruneColumns(active ? MODULE_COLUMNS[active] : MIXED_COLUMNS, rows) : []),
    [detailed, active, rows],
  );

  if (error) return <ErrorState error={error} />;
  if (isLoading) return <TableSkeleton rows={6} cols={showProject && showModule ? 6 : 4} />;

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={ShieldCheck}
        title={emptyTitle}
        description={
          emptyDescription ??
          "Nothing to remediate right now. New results appear here as soon as a scan completes."
        }
      />
    );
  }

  const showModuleCol = showModule && !active;

  return (
    <div className="-mx-5 overflow-x-auto">
      <table
        className={`w-full border-collapse text-[13px] ${detailed ? "min-w-[980px]" : "min-w-[720px]"}`}
      >
        <thead>
          <tr className="border-y border-border/60 bg-secondary/20 text-left font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            <th className="px-5 py-2 font-medium">ID</th>
            {detailed ? (
              cols.map((c) => (
                <th key={c.key} className="px-3 py-2 font-medium">
                  {c.label}
                </th>
              ))
            ) : (
              <th className="px-3 py-2 font-medium">Finding</th>
            )}
            {showProject && <th className="px-3 py-2 font-medium">Project</th>}
            {showModuleCol && <th className="px-3 py-2 font-medium">Module</th>}
            {!detailed && <th className="px-3 py-2 font-medium">Severity</th>}
            <th className="px-3 py-2 text-right font-medium">Age</th>
            {onView && <th className="px-5 py-2 text-right font-medium">View</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((f) => (
            <tr
              key={f.id}
              className="border-b border-border/40 align-top transition-colors last:border-0 hover:bg-secondary/30"
            >
              <td className="px-5 py-2.5 font-mono text-[11px] text-muted-foreground">{f.id}</td>
              {detailed ? (
                cols.map((c) => (
                  <td key={c.key} className="px-3 py-2.5">
                    {c.cell(f)}
                  </td>
                ))
              ) : (
                <td className="px-3 py-2.5">
                  <div className="max-w-[46ch] truncate font-medium text-foreground">{f.title}</div>
                  {f.location && <Mono>{f.location}</Mono>}
                </td>
              )}
              {showProject && (
                <td className="px-3 py-2.5 font-mono text-[11px] text-muted-foreground">
                  {f.project}
                </td>
              )}
              {showModuleCol && (
                <td className="px-3 py-2.5 text-[12px] text-muted-foreground">{f.moduleLabel}</td>
              )}
              {!detailed && (
                <td className="px-3 py-2.5">
                  <SeverityBadge level={f.severity} />
                </td>
              )}
              <td className="px-3 py-2.5 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
                {relativeTime(f.createdAt)}
              </td>
              {onView && (
                <td className="px-5 py-2.5 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-[11px]"
                    onClick={() => onView(f)}
                  >
                    View
                  </Button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});
