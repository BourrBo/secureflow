import type { ReactNode } from "react";
import { SeverityBadge, PriorityBadge } from "./primitives";
import {
  iacCategory,
  priorityTooltip,
  redactedMatch,
  secretTypeLabel,
  type Finding,
  type ModuleKey,
} from "@/lib/security";

/**
 * Single source of truth for how a finding is rendered. Both the per-scan
 * module tables and the global Findings table build their columns from these
 * definitions so the two views can never drift apart.
 *
 * `has` decides whether the column carries information for the current row
 * set: a column whose `has` is false for every row is dropped instead of
 * rendering a wall of "—". Columns without `has` are always shown.
 */
export type Col = {
  key: string;
  label: string;
  align?: "right";
  /** True when this row has real data for the column. */
  has?: (f: Finding) => boolean;
  cell: (f: Finding) => ReactNode;
};

const dash = (v: string) => (v ? v : "—");

export const Mono = ({ children }: { children: ReactNode }) => (
  <span className="font-mono text-[11px] text-muted-foreground">{children}</span>
);

export const Chip = ({ children, tone = "" }: { children: ReactNode; tone?: string }) => (
  <span
    className={`inline-flex items-center rounded-md border border-border/70 bg-secondary/40 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground ${tone}`}
  >
    {children}
  </span>
);

/* ── Shared columns ─────────────────────────────────────────────── */

export const colTitle: Col = {
  key: "title",
  label: "Finding",
  cell: (f) => <span className="font-medium text-foreground">{f.title}</span>,
};

export const colSeverity: Col = {
  key: "severity",
  label: "Severity",
  cell: (f) => <SeverityBadge level={f.severity} />,
};

export const colFileLine: Col = {
  key: "file",
  label: "File · Line",
  has: (f) => Boolean(f.file),
  cell: (f) => <Mono>{f.file ? `${f.file}${f.line ? `:${f.line}` : ""}` : "—"}</Mono>,
};

export const colCwe: Col = {
  key: "cwe",
  label: "CWE",
  has: (f) => Boolean(f.cwe),
  cell: (f) => <Mono>{dash(f.cwe)}</Mono>,
};

export const colOwasp: Col = {
  key: "owasp",
  label: "OWASP",
  has: (f) => Boolean(f.owasp),
  cell: (f) => <Mono>{dash(f.owasp)}</Mono>,
};

export const colIso: Col = {
  key: "iso",
  label: "ISO 27001",
  has: (f) => Boolean(f.iso),
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

export const colPriority: Col = {
  key: "priority",
  label: "Priority",
  has: (f) => f.priorityScore !== null || Boolean(f.priorityRiskLevel),
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

/* ── Dependency / container columns ─────────────────────────────── */

const colPackage: Col = {
  key: "package",
  label: "Package",
  cell: (f) => <span className="font-medium text-foreground">{f.title}</span>,
};

const colEcosystem: Col = {
  key: "ecosystem",
  label: "Ecosystem",
  has: (f) => Boolean(f.ecosystem),
  cell: (f) => <Mono>{dash(f.ecosystem)}</Mono>,
};

const colInstalled: Col = {
  key: "installed",
  label: "Installed",
  has: (f) => Boolean(f.installedVersion),
  cell: (f) => <Mono>{dash(f.installedVersion)}</Mono>,
};

const colFixIn = (label: string, emptyText?: string): Col => ({
  key: "fix",
  label,
  has: (f) => Boolean(f.fixedVersion),
  cell: (f) =>
    f.fixedVersion ? (
      <span className="font-mono text-[11px] text-success">{f.fixedVersion}</span>
    ) : emptyText ? (
      <span className="text-[11px] text-muted-foreground">{emptyText}</span>
    ) : (
      <Mono>—</Mono>
    ),
});

const colCve: Col = {
  key: "cve",
  label: "CVE",
  has: (f) => Boolean(f.cve),
  cell: (f) => <Mono>{dash(f.cve)}</Mono>,
};

const colCvss: Col = {
  key: "cvss",
  label: "CVSS",
  has: (f) => Boolean(f.cvss),
  cell: (f) => (
    <span className="font-mono text-[11px] tabular-nums text-foreground">{dash(f.cvss)}</span>
  ),
};

const colEpss: Col = {
  key: "epss",
  label: "EPSS",
  has: (f) => Boolean(f.epssScore),
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
        —
      </span>
    ),
};

/* ── Per-scanner schemas ────────────────────────────────────────── */

export const MODULE_COLUMNS: Record<ModuleKey, Col[]> = {
  sast: [
    { ...colTitle, label: "Vulnerability" },
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
    colFixIn("Fix In"),
    colCve,
    colCvss,
    colEpss,
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
    { key: "rule", label: "Check ID / Rule", cell: (f) => <Mono>{dash(f.rule)}</Mono> },
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
    colFixIn("Fixed", "No fix available"),
    colCve,
    colCvss,
    colEpss,
    colSeverity,
    colIso,
    colPriority,
  ],
  dast: [
    colSeverity,
    { ...colTitle, label: "Alert" },
    {
      key: "target",
      label: "Target",
      has: (f) => Boolean(f.file),
      cell: (f) => (
        <span
          title={f.file}
          className="block max-w-[38ch] truncate font-mono text-[11px] text-muted-foreground"
        >
          {f.file || "—"}
        </span>
      ),
    },
    colCwe,
    colOwasp,
    {
      key: "description",
      label: "Evidence · Description",
      has: (f) => Boolean(f.description),
      cell: (f) => (
        <span title={f.description} className="block max-w-[46ch] truncate text-muted-foreground">
          {dash(f.description)}
        </span>
      ),
    },
    colIso,
    colPriority,
  ],
};

/**
 * Columns used when a row set mixes scanners (the unfiltered global
 * Findings view). Scanner-specific metadata lives in the detail dialog.
 */
export const MIXED_COLUMNS: Col[] = [
  colTitle,
  colFileLine,
  colCwe,
  colCve,
  colIso,
  colSeverity,
  colPriority,
];

/** Drops columns that carry no data for any row in the current result set. */
export function pruneColumns(cols: Col[], rows: Finding[]): Col[] {
  if (rows.length === 0) return cols;
  return cols.filter((c) => !c.has || rows.some((r) => c.has!(r)));
}

/** The single module all rows belong to, or null when the set is mixed. */
export function uniformModule(rows: Finding[]): ModuleKey | null {
  const first = rows[0]?.module ?? null;
  if (!first) return null;
  return rows.every((r) => r.module === first) ? first : null;
}
