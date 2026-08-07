import { memo, useEffect, useMemo, useState, type ReactNode } from "react";
import { SeverityBadge, PriorityBadge, EmptyState } from "./primitives";
import { FindingDetailDialog } from "./FindingDetailDialog";
import {
  SEVERITY_ORDER,
  iacCategory,
  priorityTooltip,
  redactedMatch,
  secretTypeLabel,
  type Finding,
  type ModuleKey,
} from "@/lib/security";
import { ShieldCheck, ChevronLeft, ChevronRight } from "lucide-react";

type Col = {
  key: string;
  label: string;
  align?: "right";
  cell: (f: Finding) => ReactNode;
};

const dash = (v: string) => (v ? v : "—");

const Mono = ({ children }: { children: ReactNode }) => (
  <span className="font-mono text-[11px] text-muted-foreground">{children}</span>
);

const Chip = ({ children, tone = "" }: { children: ReactNode; tone?: string }) => (
  <span
    className={`inline-flex items-center rounded-md border border-border/70 bg-secondary/40 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground ${tone}`}
  >
    {children}
  </span>
);

const colSeverity: Col = {
  key: "severity",
  label: "Severity",
  cell: (f) => <SeverityBadge level={f.severity} />,
};

const colFileLine: Col = {
  key: "file",
  label: "File · Line",
  cell: (f) => <Mono>{f.file ? `${f.file}${f.line ? `:${f.line}` : ""}` : "—"}</Mono>,
};

const colCwe: Col = { key: "cwe", label: "CWE", cell: (f) => <Mono>{dash(f.cwe)}</Mono> };

const colPriority: Col = {
  key: "priority",
  label: "Priority",
  cell: (f) => (
    <PriorityBadge
      score={f.priorityScore}
      level={f.priorityRiskLevel}
      tooltip={
        f.priorityScore === null && !f.priorityRiskLevel
          ? "No priority data available"
          : priorityTooltip(f.priorityBasis)
      }
    />
  ),
};
const colOwasp: Col = { key: "owasp", label: "OWASP", cell: (f) => <Mono>{dash(f.owasp)}</Mono> };

const colIso: Col = {
  key: "iso",
  label: "ISO 27001",
  cell: (f) =>
    f.iso ? (
      <span
        title={[f.iso.name, f.iso.description].filter(Boolean).join(" — ")}
        className="inline-flex items-center rounded-md border border-accent/30 bg-accent/10 px-1.5 py-0.5 font-mono text-[10px] text-accent"
      >
        {f.iso.control}
      </span>
    ) : (
      <Mono>—</Mono>
    ),
};

const colPackage: Col = {
  key: "package",
  label: "Package",
  cell: (f) => <span className="font-medium text-foreground">{f.title}</span>,
};
const colEcosystem: Col = {
  key: "ecosystem",
  label: "Ecosystem",
  cell: (f) => <Mono>{dash(f.ecosystem)}</Mono>,
};
const colInstalled: Col = {
  key: "installed",
  label: "Installed",
  cell: (f) => <Mono>{dash(f.installedVersion)}</Mono>,
};
const colCve: Col = { key: "cve", label: "CVE", cell: (f) => <Mono>{dash(f.cve)}</Mono> };
const colCvss: Col = {
  key: "cvss",
  label: "CVSS",
  cell: (f) => (
    <span className="font-mono text-[11px] tabular-nums text-foreground">{dash(f.cvss)}</span>
  ),
};

const COLUMNS: Record<ModuleKey, Col[]> = {
  sast: [
    {
      key: "title",
      label: "Vulnerability",
      cell: (f) => <span className="font-medium text-foreground">{f.title}</span>,
    },
    colSeverity,
    colFileLine,
    colCwe,
    colOwasp,
    colIso,
    colPriority,
  ],
  sca: [
    colPackage,
    colEcosystem,
    colInstalled,
    {
      key: "fix",
      label: "Fix In",
      cell: (f) =>
        f.fixedVersion ? (
          <span className="font-mono text-[11px] text-success">{f.fixedVersion}</span>
        ) : (
          <Mono>—</Mono>
        ),
    },
    colCve,
    colCvss,
    {
      key: "epss",
      label: "EPSS",
      cell: (f) =>
        f.epssScore ? (
          <span
            title={`EPSS percentile: ${f.epssPercentile || "—"}`}
            className="font-mono text-[11px] tabular-nums text-foreground"
          >
            {f.epssScore}
          </span>
        ) : (
          <span
            title="No EPSS data for this CVE"
            className="font-mono text-[11px] text-muted-foreground"
          >
            N/A
          </span>
        ),
    },
    colSeverity,
    colIso,
    colPriority,
  ],
  secrets: [
    {
      key: "type",
      label: "Secret Type",
      cell: (f) => <span className="font-medium text-foreground">{secretTypeLabel(f.rule)}</span>,
    },
    colFileLine,
    {
      key: "match",
      label: "Redacted Match",
      cell: (f) => <Mono>{redactedMatch(f.description)}</Mono>,
    },
    {
      key: "detection",
      label: "Detection",
      cell: (f) => <Chip>{f.rule === "entropy-generic" ? "Entropy" : "Pattern match"}</Chip>,
    },
    colCwe,
    colSeverity,
    colIso,
    colPriority,
  ],
  iac: [
    {
      key: "rule",
      label: "Check ID / Rule",
      cell: (f) => <Mono>{dash(f.rule)}</Mono>,
    },
    {
      key: "description",
      label: "Description",
      cell: (f) => (
        <span title={f.description} className="block max-w-[42ch] truncate text-foreground">
          {dash(f.description)}
        </span>
      ),
    },
    colFileLine,
    { key: "category", label: "Category", cell: (f) => <Chip>{iacCategory(f.file)}</Chip> },
    colCwe,
    colSeverity,
    colIso,
    colPriority,
  ],
  container: [
    colPackage,
    colEcosystem,
    colInstalled,
    {
      key: "fixed",
      label: "Fixed",
      cell: (f) =>
        f.fixedVersion ? (
          <span className="font-mono text-[11px] text-success">{f.fixedVersion}</span>
        ) : (
          <span className="text-[11px] text-muted-foreground">No fix available</span>
        ),
    },
    colCve,
    colCvss,
    colSeverity,
    colIso,
    colPriority,
  ],
  dast: [
    colSeverity,
    {
      key: "title",
      label: "Title",
      cell: (f) => <span className="font-medium text-foreground">{f.title}</span>,
    },
    { key: "target", label: "Target", cell: (f) => <Mono>{f.file || "—"}</Mono> },
    colCwe,
    colOwasp,
    {
      key: "description",
      label: "Description",
      cell: (f) => (
        <span title={f.description} className="block max-w-[46ch] truncate text-muted-foreground">
          {dash(f.description)}
        </span>
      ),
    },
    colPriority,
  ],
};

/** Modules that expose a per-finding detail view. */
const DETAILED: ModuleKey[] = ["sast", "sca", "secrets", "container"];

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
  const cols = COLUMNS[module];
  const detailed = DETAILED.includes(module);

  const rows = useMemo(
    () =>
      [...findings]
        .map((f) =>
          module === "dast" && !f.file && target ? ({ ...f, file: target } as Finding) : f,
        )
        .sort(bySeverity),
    [findings, module, target],
  );

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
