import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  PageHeader,
  Panel,
  CardsSkeleton,
  EmptyState,
  ErrorState,
} from "@/components/dashboard/primitives";
import { complianceQuery, findingsQuery } from "@/lib/queries";
import { ShieldCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { Framework } from "@/lib/security";

export const Route = createFileRoute("/dashboard/compliance")({ component: Compliance });

const SEVERITY_ORDER = ["critical", "high", "medium", "low"] as const;

function severityDotClass(severity: string): string {
  switch (severity.toLowerCase()) {
    case "critical":
      return "bg-critical";
    case "high":
      return "bg-warning";
    case "medium":
    case "info":
      return "bg-info";
    case "low":
      return "bg-muted-foreground";
    default:
      return "bg-muted-foreground";
  }
}

function severityCount(bySeverity?: Record<string, number>, severity: string = ""): number {
  if (!bySeverity) return 0;
  return Number(
    bySeverity[severity] ??
      bySeverity[severity.toUpperCase()] ??
      bySeverity[severity.toLowerCase()] ??
      0,
  );
}

function Compliance() {
  const { data, isLoading, error } = useQuery(complianceQuery());
  const findings = useQuery(findingsQuery());
  const [selected, setSelected] = useState<Framework | null>(null);

  const frameworks = data?.frameworks ?? [];
  const controls = data?.controls ?? [];
  const hasEvidence = (findings.data?.length ?? 0) > 0;

  return (
    <>
      <PageHeader
        eyebrow="Workspace"
        title="Compliance"
        description="Continuous, automated evidence collection across the frameworks your customers require."
      />
      {error ? (
        <ErrorState error={error} />
      ) : isLoading ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <CardsSkeleton count={6} height={116} />
        </div>
      ) : !hasEvidence && !findings.isLoading ? (
        <EmptyState
          icon={ShieldCheck}
          title="No scan evidence"
          description="Compliance is not assessed yet. Run a scan to collect evidence — an absence of findings is not proof of compliance."
        />
      ) : frameworks.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="No frameworks enabled"
          description="Enable a framework to map your findings to controls and collect evidence automatically."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {frameworks.map((f) => (
            <button key={f.name} type="button" onClick={() => setSelected(f)} className="text-left">
              <Panel>
                <div className="flex items-center gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-semibold">{f.name}</div>
                    {f.assessed && f.controls && (
                      <div className="text-[11px] text-muted-foreground">{f.controls} controls</div>
                    )}
                  </div>
                  {f.assessed && (
                    <div className="ml-auto font-display text-xl font-semibold tabular-nums gradient-text">
                      {f.pct}%
                    </div>
                  )}
                </div>
                {f.assessed ? (
                  <div className="mt-4 h-1 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-[image:var(--gradient-primary)]"
                      style={{ width: `${f.pct}%` }}
                    />
                  </div>
                ) : (
                  // No completed scan in scope: a 0% bar would read as
                  // "failing" when the truth is "unknown".
                  <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
                    Not assessed yet — run a scan to see your {f.name} posture.
                  </p>
                )}
              </Panel>
            </button>
          ))}

        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selected?.name}</DialogTitle>
            <DialogDescription>
              Controls and finding severity breakdown for this framework.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2 space-y-3">
            {controls
              .filter(
                (c) =>
                  !selected?.name ||
                  !c.framework ||
                  c.framework === selected.name ||
                  c.framework === null ||
                  c.framework === undefined,
              )
              .sort((a, b) => (b.total_findings ?? 0) - (a.total_findings ?? 0))
              .map((c) => (
                <div
                  key={c.control_id}
                  className="rounded-lg border border-border/70 bg-secondary/20 p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-medium">
                        {c.control_name || c.control_id || "Control"}
                      </div>
                      {c.control_description && (
                        <div className="mt-0.5 text-[11px] text-muted-foreground">
                          {c.control_description}
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 text-[13px] font-semibold tabular-nums">
                      {c.total_findings ?? 0} findings
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {SEVERITY_ORDER.map((s) => {
                      const count = severityCount(c.by_severity, s);
                      if (count === 0) return null;
                      return (
                        <span
                          key={s}
                          className="inline-flex items-center rounded-full bg-background px-2 py-0.5 text-[11px] font-medium ring-1 ring-border/70"
                        >
                          <span
                            className={`mr-1 h-1.5 w-1.5 rounded-full ${severityDotClass(s)}`}
                          />
                          {s}: {count}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
