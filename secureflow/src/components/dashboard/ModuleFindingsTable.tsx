import { memo, useEffect, useMemo, useState } from "react";
import { EmptyState } from "./primitives";
import { FindingDetailDialog } from "./FindingDetailDialog";
import { MODULE_COLUMNS, pruneColumns } from "./findingColumns";
import { SEVERITY_ORDER, type Finding, type ModuleKey } from "@/lib/security";
import { ShieldCheck, ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Rendering every row of a large result set at once (a full DAST scan can
 * return several thousand ZAP alerts in a single response) puts thousands of
 * <tr> elements into the DOM in one React commit. That's what was freezing /
 * crashing the tab after a DAST scan — it has nothing to do with the device's
 * sleep/power settings. Paginating client-side keeps every finding in memory
 * (nothing is lost, "Export report" and search/sort still see all of them)
 * but only ever mounts one page of rows.
 */
const PAGE_SIZE = 100;

function bySeverity(a: Finding, b: Finding) {
  return SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity);
}

export const ModuleFindingsTable = memo(function ModuleFindingsTable({
  module,
  findings,
  target,
  emptyTitle,
  emptyDescription,
}: {
  module: ModuleKey;
  findings: Finding[];
  /** Scanned target — used as the DAST fallback when a finding has no file. */
  target?: string;
  emptyTitle: string;
  emptyDescription: string;
}) {
  const [selected, setSelected] = useState<Finding | null>(null);
  const [page, setPage] = useState(0);
  const detailed = true;

  const rows = useMemo(
    () =>
      [...findings]
        .map((f) =>
          module === "dast" && !f.file && target ? ({ ...f, file: target } as Finding) : f,
        )
        .sort(bySeverity),
    [findings, module, target],
  );

  const cols = useMemo(() => pruneColumns(MODULE_COLUMNS[module], rows), [module, rows]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));

  useEffect(() => {
    setPage(0);
  }, [rows]);

  const clampedPage = Math.min(page, pageCount - 1);
  const start = clampedPage * PAGE_SIZE;
  const visibleRows = rows.slice(start, start + PAGE_SIZE);

  if (rows.length === 0) {
    return <EmptyState icon={ShieldCheck} title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <>
      <div className="-mx-5 overflow-x-auto">
        <table className="w-full min-w-[860px] border-collapse text-[13px]">
          <thead>
            <tr className="border-y border-border/60 bg-secondary/20 text-left font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              {cols.map((c, i) => (
                <th key={c.key} className={`py-2 font-medium ${i === 0 ? "pl-5 pr-3" : "px-3"}`}>
                  {c.label}
                </th>
              ))}
              {detailed && <th className="px-5 py-2 text-right font-medium">View</th>}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((f, idx) => (
              <tr
                key={`${f.id}-${start + idx}`}
                className="border-b border-border/40 align-top transition-colors last:border-0 hover:bg-secondary/30"
              >
                {cols.map((c, i) => (
                  <td key={c.key} className={`py-2.5 ${i === 0 ? "pl-5 pr-3" : "px-3"}`}>
                    {c.cell(f)}
                  </td>
                ))}
                {detailed && (
                  <td className="px-5 py-2.5 text-right">
                    <button
                      onClick={() => setSelected(f)}
                      className="font-mono text-[11px] text-accent transition-opacity hover:opacity-70"
                    >
                      View →
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length > PAGE_SIZE && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/40 px-5 py-3">
          <span className="font-mono text-[11px] text-muted-foreground">
            Showing {start + 1}–{Math.min(start + PAGE_SIZE, rows.length)} of{" "}
            {rows.length.toLocaleString()} findings
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={clampedPage === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="inline-flex items-center gap-1 rounded-md border border-border/70 px-2 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Prev
            </button>
            <span className="px-2 font-mono text-[11px] text-muted-foreground">
              Page {clampedPage + 1} of {pageCount}
            </span>
            <button
              type="button"
              disabled={clampedPage >= pageCount - 1}
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              className="inline-flex items-center gap-1 rounded-md border border-border/70 px-2 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      <FindingDetailDialog finding={selected} onOpenChange={(o) => !o && setSelected(null)} />
    </>
  );
});
