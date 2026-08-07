import { memo } from "react";
import { SeverityBadge, EmptyState, ErrorState, TableSkeleton } from "./primitives";
import { relativeTime, SEVERITY_ORDER, type Finding } from "@/lib/security";
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
  emptyTitle = "No findings",
  emptyDescription,
}: {
  findings?: Finding[];
  isLoading?: boolean;
  error?: unknown;
  limit?: number;
  showProject?: boolean;
  showModule?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  if (error) return <ErrorState error={error} />;
  if (isLoading) return <TableSkeleton rows={6} cols={showProject && showModule ? 6 : 4} />;

  const rows = [...(findings ?? [])].sort(bySeverityThenDate).slice(0, limit ?? undefined);
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

  return (
    <div className="-mx-5 overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-[13px]">
        <thead>
          <tr className="border-y border-border/60 bg-secondary/20 text-left font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            <th className="px-5 py-2 font-medium">ID</th>
            <th className="px-3 py-2 font-medium">Finding</th>
            {showProject && <th className="px-3 py-2 font-medium">Project</th>}
            {showModule && <th className="px-3 py-2 font-medium">Module</th>}
            <th className="px-3 py-2 font-medium">Severity</th>
            <th className="px-5 py-2 text-right font-medium">Age</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((f) => (
            <tr
              key={f.id}
              className="border-b border-border/40 transition-colors last:border-0 hover:bg-secondary/30"
            >
              <td className="px-5 py-2.5 font-mono text-[11px] text-muted-foreground">{f.id}</td>
              <td className="px-3 py-2.5">
                <div className="max-w-[46ch] truncate font-medium text-foreground">{f.title}</div>
                {f.location && (
                  <div className="truncate font-mono text-[11px] text-muted-foreground">
                    {f.location}
                  </div>
                )}
              </td>
              {showProject && (
                <td className="px-3 py-2.5 font-mono text-[11px] text-muted-foreground">
                  {f.project}
                </td>
              )}
              {showModule && (
                <td className="px-3 py-2.5 text-[12px] text-muted-foreground">{f.moduleLabel}</td>
              )}
              <td className="px-3 py-2.5">
                <SeverityBadge level={f.severity} />
              </td>
              <td className="px-5 py-2.5 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
                {relativeTime(f.createdAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});
