import { lazy, Suspense, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  PageHeader,
  StatCard,
  Panel,
  ErrorState,
  EmptyState,
} from "@/components/dashboard/primitives";
import { FindingsTable } from "@/components/dashboard/FindingsTable";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { findingsQuery, complianceQuery, projectsQuery } from "@/lib/queries";
import {
  buildTrend,
  countBySeverity,
  securityScore,
  MODULE_LABEL,
  type ModuleKey,
} from "@/lib/security";
import {
  Bug,
  ShieldAlert,
  AlertTriangle,
  FolderGit2,
  ArrowRight,
  Code2,
  Package,
  KeyRound,
  Boxes,
  Container,
  Radar,
  ShieldCheck,
} from "lucide-react";

const FindingsTrendChart = lazy(() => import("@/components/dashboard/FindingsTrendChart"));

export const Route = createFileRoute("/dashboard/")({ component: Overview });

const MODULE_META: Array<{ key: ModuleKey; icon: typeof Code2; to: string }> = [
  { key: "sast", icon: Code2, to: "/dashboard/sast" },
  { key: "sca", icon: Package, to: "/dashboard/sca" },
  { key: "secrets", icon: KeyRound, to: "/dashboard/secrets" },
  { key: "iac", icon: Boxes, to: "/dashboard/iac" },
  { key: "container", icon: Container, to: "/dashboard/container" },
  { key: "dast", icon: Radar, to: "/dashboard/dast" },
];

function Overview() {
  const findings = useQuery(findingsQuery());
  const projects = useQuery(projectsQuery());
  const compliance = useQuery(complianceQuery());

  const all = useMemo(() => findings.data ?? [], [findings.data]);
  const counts = useMemo(() => countBySeverity(all), [all]);
  const trend = useMemo(() => buildTrend(all), [all]);
  const score = useMemo(() => securityScore(all), [all]);
  const perModule = useMemo(() => {
    const map = new Map<ModuleKey, { crit: number; high: number; med: number; total: number }>();
    for (const m of MODULE_META) map.set(m.key, { crit: 0, high: 0, med: 0, total: 0 });
    for (const f of all) {
      if (!f.module) continue;
      const e = map.get(f.module)!;
      e.total += 1;
      if (f.severity === "critical") e.crit += 1;
      else if (f.severity === "high") e.high += 1;
      else if (f.severity === "medium") e.med += 1;
    }
    return map;
  }, [all]);

  const loading = findings.isLoading;
  const dash = loading || findings.error ? "—" : undefined;

  return (
    <>
      <PageHeader
        eyebrow="Workspace overview"
        title="Security posture"
        description="A unified view of every finding, module and framework across your organization."
      />

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Open findings"
          value={dash ?? all.length}
          tone="warning"
          icon={Bug}
          loading={loading}
        />
        <StatCard
          label="Critical"
          value={dash ?? counts.critical}
          tone="critical"
          icon={ShieldAlert}
          loading={loading}
        />
        <StatCard
          label="High"
          value={dash ?? counts.high}
          tone="warning"
          icon={AlertTriangle}
          loading={loading}
        />
        <StatCard
          label="Projects"
          value={projects.isLoading || projects.error ? "—" : (projects.data?.length ?? 0)}
          tone="info"
          icon={FolderGit2}
          loading={projects.isLoading}
        />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Panel
          title="Open findings over time"
          description="Rolling 7-day view by severity"
          className="lg:col-span-2"
        >
          {findings.error ? (
            <ErrorState error={findings.error} />
          ) : loading ? (
            <Skeleton className="h-56 w-full rounded-lg" />
          ) : all.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title="No findings recorded"
              description="Once a scan completes, severity trends appear here."
            />
          ) : (
            <Suspense fallback={<Skeleton className="h-56 w-full rounded-lg" />}>
              <FindingsTrendChart data={trend} />
            </Suspense>
          )}
        </Panel>

        <Panel
          title="Security score"
          description={all.length === 0 ? "No scan evidence yet" : "Weighted by open severity"}
        >
          <div className="flex flex-col items-center py-1">
            {loading ? (
              <Skeleton className="h-36 w-36 rounded-full" />
            ) : all.length === 0 ? (
              <div className="grid h-36 w-36 place-items-center rounded-full border border-dashed border-border/70 text-center">
                <div>
                  <div className="font-display text-4xl font-semibold leading-none">—</div>
                  <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                    Not assessed
                  </div>
                </div>
              </div>
            ) : (
              <div className="relative grid h-36 w-36 place-items-center">
                <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    stroke="var(--secondary)"
                    strokeWidth="7"
                    fill="none"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    stroke="url(#scoreGrad)"
                    strokeWidth="7"
                    fill="none"
                    strokeDasharray={`${(score / 100) * 264} 264`}
                    strokeLinecap="round"
                  />
                  <defs>
                    <linearGradient id="scoreGrad" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" />
                      <stop offset="100%" stopColor="var(--accent)" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="text-center">
                  <div className="font-display text-4xl font-semibold tabular-nums">
                    {findings.error ? "—" : score}
                  </div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                    / 100
                  </div>
                </div>
              </div>
            )}
            {!loading && all.length === 0 && (
              <p className="mt-3 text-center text-[11px] text-muted-foreground">
                No findings recorded — run a scan to calculate score.
              </p>
            )}
            <div className="mt-4 w-full space-y-1.5">
              {(["critical", "high", "medium", "low"] as const).map((s) => (
                <div key={s} className="flex items-center justify-between text-[11px]">
                  <span className="font-mono uppercase tracking-[0.12em] text-muted-foreground">
                    {s}
                  </span>
                  <span className="tabular-nums text-foreground">{loading ? "—" : counts[s]}</span>
                </div>
              ))}
            </div>
          </div>
        </Panel>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Panel
          title="Modules"
          description="Coverage across your scanning pipeline"
          className="lg:col-span-2"
        >
          <div className="grid gap-2.5 sm:grid-cols-2">
            {MODULE_META.map((m) => {
              const c = perModule.get(m.key)!;
              return (
                <Link
                  key={m.key}
                  to={m.to}
                  className="group flex items-center gap-3 rounded-lg border border-border/70 bg-secondary/20 p-3 transition-colors hover:border-primary/40 hover:bg-secondary/50"
                >
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
                    <m.icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold">{MODULE_LABEL[m.key]}</div>
                    <div className="mt-0.5 flex gap-2.5 font-mono text-[11px] text-muted-foreground">
                      {loading ? (
                        <Skeleton className="h-3 w-24" />
                      ) : (
                        <>
                          <span>
                            <span className="text-critical">{c.crit}</span> crit
                          </span>
                          <span>
                            <span className="text-warning">{c.high}</span> high
                          </span>
                          <span>
                            <span className="text-info">{c.med}</span> med
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                </Link>
              );
            })}
          </div>
        </Panel>

        <Panel
          title="Compliance coverage"
          description="Automated evidence collection"
          actions={
            <Button asChild variant="ghost" size="sm">
              <Link to="/dashboard/compliance">
                All <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          }
        >
          {compliance.error ? (
            <ErrorState error={compliance.error} />
          ) : compliance.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-8" />
              ))}
            </div>
          ) : (compliance.data?.frameworks.length ?? 0) === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title="No frameworks tracked"
              description="Enable a framework to start collecting evidence automatically."
            />
          ) : (
            <ul className="space-y-3">
              {compliance.data!.frameworks.slice(0, 5).map((c) => (
                <li key={c.name}>
                  <div className="flex items-center justify-between text-[12px]">
                    <span>{c.name}</span>
                    <span className="font-mono tabular-nums text-muted-foreground">{c.pct}%</span>
                  </div>
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-[image:var(--gradient-primary)]"
                      style={{ width: `${c.pct}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel
        title="Priority findings"
        description="Highest-severity issues across your workspace"
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link to="/dashboard/findings" search={{ q: "" }}>
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        }
        className="mt-5"
      >
        <FindingsTable findings={all} isLoading={loading} error={findings.error} limit={6} />
      </Panel>
    </>
  );
}
