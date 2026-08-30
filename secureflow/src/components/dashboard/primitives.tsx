import { memo, type ElementType, type ReactNode } from "react";
import { ArrowUpRight, ArrowDownRight, Inbox, PlugZap, Copy } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { normalizeStatus } from "@/lib/security";
import { ApiHttpError } from "@/lib/api";



export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-border/60 pb-5">
      <div className="min-w-0">
        {eyebrow && (
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">
            {eyebrow}
          </div>
        )}
        <h1 className="mt-1.5 truncate font-display text-2xl font-semibold tracking-tight">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </div>
  );
}

const TONE_TEXT = {
  success: "text-success",
  warning: "text-warning",
  critical: "text-critical",
  info: "text-info",
} as const;

export type Tone = keyof typeof TONE_TEXT;

export const StatCard = memo(function StatCard({
  label,
  value,
  delta,
  tone = "info",
  icon: Icon,
  loading,
  hint,
}: {
  label: string;
  value: string | number;
  delta?: string;
  tone?: Tone;
  icon?: ElementType;
  loading?: boolean;
  hint?: string;
}) {
  const up = delta?.startsWith("+");
  return (
    <div className="surface-card group relative overflow-hidden rounded-xl p-4">
      <div className="absolute inset-x-0 top-0 h-px bg-[image:var(--gradient-primary)] opacity-0 transition-opacity group-hover:opacity-60" />
      <div className="flex items-center justify-between gap-2">
        <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </div>
        {Icon && <Icon className={`h-3.5 w-3.5 ${TONE_TEXT[tone]}`} />}
      </div>
      <div className="mt-2.5 flex items-baseline gap-2">
        {loading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <div className="font-display text-[28px] font-semibold leading-none tabular-nums">
            {value}
          </div>
        )}
        {!loading && delta && (
          <span
            className={`inline-flex items-center gap-0.5 text-[11px] ${up ? "text-critical" : "text-success"}`}
          >
            {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {delta}
          </span>
        )}
      </div>
      {hint && <div className="mt-1.5 text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
});

export function SeverityBadge({
  level,
}: {
  level: "critical" | "high" | "medium" | "low" | "info";
}) {
  const map = {
    critical: "border-critical/40 bg-critical/10 text-critical",
    high: "border-warning/40 bg-warning/10 text-warning",
    medium: "border-info/40 bg-info/10 text-info",
    low: "border-muted-foreground/30 bg-muted/50 text-muted-foreground",
    info: "border-info/40 bg-info/10 text-info",
  } as const;
  return (
    <span
      className={`inline-flex items-center rounded-md border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] ${map[level]}`}
    >
      {level}
    </span>
  );
}

/**
 * Exploit-priority badge. Uses a filled pill on the accent/success scale so it
 * reads as a distinct signal from the outlined SeverityBadge next to it.
 */
export function PriorityBadge({
  score,
  level,
  tooltip,
}: {
  score: number | null;
  level: "critical" | "high" | "medium" | "low" | null;
  tooltip: string;
}) {
  if (score === null && !level) {
    return (
      <span title={tooltip} className="font-mono text-[11px] text-muted-foreground">
        —
      </span>
    );
  }
  const map = {
    critical: "bg-critical/20 text-critical",
    high: "bg-warning/20 text-warning",
    medium: "bg-accent/20 text-accent",
    low: "bg-muted/60 text-muted-foreground",
  } as const;
  return (
    <span title={tooltip} className="inline-flex items-center gap-1.5">
      <span
        className={`inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.12em] ${
          level ? map[level] : "bg-muted/60 text-muted-foreground"
        }`}
      >
        {level ?? "—"}
      </span>
      <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
        {score === null ? "—" : score.toFixed(1)}
      </span>
    </span>
  );
}

/** Lifecycle state of a finding — same outlined shape as SeverityBadge. */
export function StatusBadge({ status }: { status: string }) {
  const key = normalizeStatus(status);
  const map = {
    Open: "border-muted-foreground/30 bg-muted/50 text-muted-foreground",
    Triaged: "border-info/40 bg-info/10 text-info",
    Fixed: "border-success/40 bg-success/10 text-success",
    Accepted: "border-warning/40 bg-warning/10 text-warning",
  } as const;
  return (
    <span
      className={`inline-flex items-center rounded-md border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] ${map[key]}`}
    >
      {key}
    </span>
  );
}

/** Compact "×N" marker: this finding was detected N more times elsewhere. */
export function DuplicateBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span
      title={`Also detected by ${count} other scan${count === 1 ? "" : "s"} or scanner${count === 1 ? "" : "s"}`}
      className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-secondary/40 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
    >
      <Copy className="h-2.5 w-2.5" />×{count}
    </span>
  );
}



export function Panel({
  title,
  description,
  actions,
  children,
  className = "",
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`surface-card rounded-xl p-5 ${className}`}>
      {(title || actions) && (
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            {title && (
              <h3 className="font-display text-sm font-semibold tracking-tight">{title}</h3>
            )}
            {description && (
              <p className="mt-0.5 text-[11px] text-muted-foreground">{description}</p>
            )}
          </div>
          <div className="shrink-0">{actions}</div>
        </div>
      )}
      {children}
    </div>
  );
}

/* ── States ───────────────────────────────────────────────────────── */

export function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
  action,
}: {
  title: string;
  description?: string;
  icon?: ElementType;
  action?: ReactNode;
}) {
  return (
    <div className="grid place-items-center rounded-lg border border-dashed border-border/70 bg-secondary/20 px-6 py-14 text-center">
      <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
        <Icon className="h-5 w-5" />
      </div>
      <div className="mt-3 text-sm font-medium text-foreground">{title}</div>
      {description && (
        <p className="mt-1 max-w-sm text-[13px] text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

const HTTP_HEADINGS: Record<number, string> = {
  401: "Connection expired",
  403: "Access denied",
  404: "Not found",
  429: "Rate limited",
  502: "Request failed",
  503: "Request failed",
};

export function ErrorState({ error, action }: { error: unknown; action?: ReactNode }) {
  const message = error instanceof Error ? error.message : "Something went wrong.";
  // Only a genuine fetch() failure means the backend is actually unreachable.
  // An HTTP response — even a 5xx — means we reached it and one request failed.
  const heading =
    error instanceof ApiHttpError
      ? (HTTP_HEADINGS[error.status] ?? "Something went wrong")
      : "Backend unavailable";
  return (
    <div className="grid place-items-center rounded-lg border border-dashed border-warning/40 bg-warning/5 px-6 py-12 text-center">
      <div className="grid h-11 w-11 place-items-center rounded-xl bg-warning/10 text-warning ring-1 ring-warning/20">
        <PlugZap className="h-5 w-5" />
      </div>
      <div className="mt-3 text-sm font-medium text-foreground">{heading}</div>
      <p className="mt-1 max-w-md text-[13px] text-muted-foreground">{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}


export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className="grid gap-3"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}
        >
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className="h-4" style={{ opacity: 1 - r * 0.1 }} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardsSkeleton({ count = 6, height = 120 }: { count?: number; height?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="rounded-xl" style={{ height }} />
      ))}
    </>
  );
}
