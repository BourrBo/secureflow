import type { ReactNode } from "react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-8 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
      <div className="min-w-0">
        {eyebrow && <div className="font-mono text-[11px] uppercase tracking-widest text-accent">{eyebrow}</div>}
        <h1 className="mt-1 truncate font-display text-3xl font-bold tracking-tight">{title}</h1>
        {description && <p className="mt-2 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, delta, tone = "info", icon: Icon }: { label: string; value: string; delta?: string; tone?: "success" | "warning" | "critical" | "info"; icon?: React.ElementType }) {
  const toneCls = tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : tone === "critical" ? "text-critical" : "text-info";
  const up = delta?.startsWith("+");
  return (
    <div className="surface-card rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        {Icon && <Icon className={`h-4 w-4 ${toneCls}`} />}
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <div className="font-display text-3xl font-bold">{value}</div>
        {delta && (
          <span className={`inline-flex items-center gap-0.5 text-xs ${up ? "text-critical" : "text-success"}`}>
            {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {delta}
          </span>
        )}
      </div>
    </div>
  );
}

export function SeverityBadge({ level }: { level: "critical" | "high" | "medium" | "low" | "info" }) {
  const map = {
    critical: "border-critical/40 bg-critical/10 text-critical",
    high: "border-warning/40 bg-warning/10 text-warning",
    medium: "border-info/40 bg-info/10 text-info",
    low: "border-muted-foreground/30 bg-muted/50 text-muted-foreground",
    info: "border-info/40 bg-info/10 text-info",
  } as const;
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest ${map[level]}`}>
      {level}
    </span>
  );
}

export function Panel({ title, description, actions, children, className = "" }: { title?: string; description?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={`surface-card rounded-2xl p-6 ${className}`}>
      {(title || actions) && (
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            {title && <h3 className="font-display text-base font-semibold">{title}</h3>}
            {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}

export function ModulePlaceholder({ name, description }: { name: string; description: string }) {
  return (
    <>
      <PageHeader eyebrow={`Scanner · ${name}`} title={`${name} scanner`} description={description} />
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Findings" value="—" tone="info" />
        <StatCard label="Critical" value="—" tone="critical" />
        <StatCard label="Auto-fixed" value="—" tone="success" />
        <StatCard label="Last scan" value="—" tone="info" />
      </div>
      <Panel title="Recent scans" className="mt-6">
        <div className="grid place-items-center py-16 text-center text-sm text-muted-foreground">
          <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">✦</div>
          <div className="font-medium text-foreground">No scans yet</div>
          <div className="mt-1 max-w-sm">Connect a repository and run your first {name} scan to see findings, trends, and remediations here.</div>
        </div>
      </Panel>
    </>
  );
}