import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader, StatCard, Panel, SeverityBadge } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import {
  Bug, ShieldAlert, CheckCircle2, Clock, TrendingDown, ArrowRight,
  Code2, Package, KeyRound, Boxes, Container, Radar,
} from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";

export const Route = createFileRoute("/dashboard/")({
  component: Overview,
});

const trend = [
  { d: "Mon", critical: 12, high: 24, medium: 40 },
  { d: "Tue", critical: 10, high: 22, medium: 38 },
  { d: "Wed", critical: 14, high: 27, medium: 42 },
  { d: "Thu", critical: 9, high: 21, medium: 36 },
  { d: "Fri", critical: 7, high: 18, medium: 30 },
  { d: "Sat", critical: 6, high: 16, medium: 28 },
  { d: "Sun", critical: 5, high: 14, medium: 26 },
];

const modules = [
  { icon: Code2, name: "SAST", to: "/dashboard/sast", crit: 8, high: 14, med: 22, status: "active" },
  { icon: Package, name: "SCA", to: "/dashboard/sca", crit: 3, high: 9, med: 14, status: "active" },
  { icon: KeyRound, name: "Secrets", to: "/dashboard/secrets", crit: 2, high: 0, med: 0, status: "active" },
  { icon: Boxes, name: "IaC", to: "/dashboard/iac", crit: 1, high: 5, med: 12, status: "active" },
  { icon: Container, name: "Container", to: "/dashboard/container", crit: 0, high: 0, med: 0, status: "clean" },
  { icon: Radar, name: "DAST", to: "/dashboard/dast", crit: 0, high: 3, med: 8, status: "active" },
];

const findings = [
  { id: "SF-1042", title: "Hardcoded AWS access key in `deploy.sh`", project: "api-gateway", scanner: "Secrets", severity: "critical" as const, age: "12m ago" },
  { id: "SF-1041", title: "SQL injection risk in `users.controller.ts:187`", project: "billing-svc", scanner: "SAST", severity: "critical" as const, age: "48m ago" },
  { id: "SF-1039", title: "CVE-2024-4133 in lodash@4.17.20 (CVSS 9.1)", project: "web-app", scanner: "SCA", severity: "high" as const, age: "3h ago" },
  { id: "SF-1035", title: "S3 bucket publicly writable in `terraform/main.tf`", project: "infra-core", scanner: "IaC", severity: "high" as const, age: "5h ago" },
  { id: "SF-1030", title: "Missing rate-limiting on `/auth/reset` endpoint", project: "billing-svc", scanner: "DAST", severity: "medium" as const, age: "yesterday" },
];

function Overview() {
  return (
    <>
      <PageHeader
        eyebrow="Workspace · acme"
        title="Security overview"
        description="A unified view of your organization's security posture across all scanners."
        actions={<Button variant="hero" size="sm">Run all scans</Button>}
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Open findings" value="127" delta="−18%" tone="warning" icon={Bug} />
        <StatCard label="Critical" value="14" delta="−22%" tone="critical" icon={ShieldAlert} />
        <StatCard label="Auto-fixed (7d)" value="43" delta="+12%" tone="success" icon={CheckCircle2} />
        <StatCard label="Mean time to fix" value="2.3d" delta="−31%" tone="info" icon={Clock} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Panel title="Findings trend" description="Last 7 days across all scanners" className="lg:col-span-2">
          <div className="h-64 w-full">
            <ResponsiveContainer>
              <AreaChart data={trend} margin={{ left: -20, right: 0, top: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="gCrit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.63 0.24 20)" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="oklch(0.63 0.24 20)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gHigh" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.80 0.15 75)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="oklch(0.80 0.15 75)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gMed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.66 0.19 258)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="oklch(0.66 0.19 258)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="oklch(1 0 0 / 0.06)" vertical={false} />
                <XAxis dataKey="d" stroke="oklch(0.7 0.03 258)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="oklch(0.7 0.03 258)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "oklch(0.2 0.028 260)", border: "1px solid oklch(0.3 0.02 260)", borderRadius: 12, fontSize: 12 }} />
                <Area type="monotone" dataKey="medium" stroke="oklch(0.66 0.19 258)" fill="url(#gMed)" strokeWidth={2} />
                <Area type="monotone" dataKey="high" stroke="oklch(0.80 0.15 75)" fill="url(#gHigh)" strokeWidth={2} />
                <Area type="monotone" dataKey="critical" stroke="oklch(0.63 0.24 20)" fill="url(#gCrit)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Security score" description="Weighted across all modules">
          <div className="flex flex-col items-center py-2">
            <div className="relative grid h-40 w-40 place-items-center">
              <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" stroke="oklch(0.28 0.025 260)" strokeWidth="8" fill="none" />
                <circle cx="50" cy="50" r="42" stroke="url(#scoreGrad)" strokeWidth="8" fill="none"
                  strokeDasharray={`${(78 / 100) * 264} 264`} strokeLinecap="round" />
                <defs>
                  <linearGradient id="scoreGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="oklch(0.66 0.19 258)" />
                    <stop offset="100%" stopColor="oklch(0.80 0.15 195)" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="text-center">
                <div className="font-display text-4xl font-bold">78</div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">/ 100</div>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs text-success">
              <TrendingDown className="h-3.5 w-3.5" /> +6 pts vs last week
            </div>
          </div>
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Panel title="Scanner modules" description="Live status per engine" className="lg:col-span-2">
          <div className="grid gap-3 sm:grid-cols-2">
            {modules.map((m) => (
              <Link key={m.name} to={m.to} className="group flex items-center gap-4 rounded-xl border border-border bg-secondary/30 p-4 transition-colors hover:border-primary/40 hover:bg-secondary/60">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
                  <m.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{m.name}</span>
                    <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{m.status}</span>
                  </div>
                  <div className="mt-1 flex gap-3 text-xs text-muted-foreground">
                    <span><span className="text-critical">{m.crit}</span> crit</span>
                    <span><span className="text-warning">{m.high}</span> high</span>
                    <span><span className="text-info">{m.med}</span> med</span>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
              </Link>
            ))}
          </div>
        </Panel>

        <Panel title="Compliance coverage" description="Automated evidence collection">
          <ul className="space-y-3 text-sm">
            {[
              { name: "SOC 2 Type II", pct: 92 },
              { name: "ISO 27001:2022", pct: 78 },
              { name: "PCI DSS 4.0", pct: 64 },
              { name: "HIPAA", pct: 51 },
            ].map((c) => (
              <li key={c.name}>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-foreground">{c.name}</span>
                  <span className="font-mono text-muted-foreground">{c.pct}%</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full rounded-full bg-[image:var(--gradient-primary)]" style={{ width: `${c.pct}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel title="Recent findings" description="Highest-priority issues across your workspace" actions={<Button asChild variant="ghost" size="sm"><Link to="/dashboard/findings">View all <ArrowRight className="h-3.5 w-3.5" /></Link></Button>} className="mt-6">
        <div className="-mx-6 overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b border-border text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                <th className="px-6 py-3 font-medium">ID</th>
                <th className="px-3 py-3 font-medium">Finding</th>
                <th className="px-3 py-3 font-medium">Project</th>
                <th className="px-3 py-3 font-medium">Scanner</th>
                <th className="px-3 py-3 font-medium">Severity</th>
                <th className="px-6 py-3 font-medium">Age</th>
              </tr>
            </thead>
            <tbody>
              {findings.map((f) => (
                <tr key={f.id} className="border-b border-border/40 transition-colors hover:bg-secondary/40">
                  <td className="px-6 py-3 font-mono text-xs text-muted-foreground">{f.id}</td>
                  <td className="px-3 py-3 font-medium">{f.title}</td>
                  <td className="px-3 py-3 font-mono text-xs text-muted-foreground">{f.project}</td>
                  <td className="px-3 py-3 text-muted-foreground">{f.scanner}</td>
                  <td className="px-3 py-3"><SeverityBadge level={f.severity} /></td>
                  <td className="px-6 py-3 text-xs text-muted-foreground">{f.age}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}