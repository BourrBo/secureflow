import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Panel, SeverityBadge, StatCard } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bug, ShieldAlert, CheckCircle2, Clock, Filter, Download } from "lucide-react";

export const Route = createFileRoute("/dashboard/findings")({ component: Findings });

const rows = [
  { id: "SF-1042", title: "Hardcoded AWS access key in `deploy.sh`", project: "api-gateway", scanner: "Secrets", severity: "critical" as const, assignee: "Ada L.", age: "12m" },
  { id: "SF-1041", title: "SQL injection in `users.controller.ts:187`", project: "billing-svc", scanner: "SAST", severity: "critical" as const, assignee: "Rafi K.", age: "48m" },
  { id: "SF-1039", title: "CVE-2024-4133 · lodash@4.17.20", project: "web-app", scanner: "SCA", severity: "high" as const, assignee: "—", age: "3h" },
  { id: "SF-1035", title: "S3 bucket publicly writable", project: "infra-core", scanner: "IaC", severity: "high" as const, assignee: "Priya R.", age: "5h" },
  { id: "SF-1030", title: "Missing rate-limit on `/auth/reset`", project: "billing-svc", scanner: "DAST", severity: "medium" as const, assignee: "—", age: "1d" },
  { id: "SF-1024", title: "Weak TLS ciphers on ingress-nginx", project: "infra-core", scanner: "Container", severity: "medium" as const, assignee: "Ada L.", age: "2d" },
  { id: "SF-1017", title: "Debug flag enabled in production build", project: "web-app", scanner: "SAST", severity: "low" as const, assignee: "—", age: "3d" },
];

function Findings() {
  return (
    <>
      <PageHeader
        eyebrow="Workspace · Findings"
        title="All findings"
        description="Every open issue across every scanner, prioritized by CVSS + EPSS."
        actions={<div className="flex gap-2"><Button variant="outline" size="sm"><Download className="h-3.5 w-3.5" /> Export</Button><Button variant="hero" size="sm">Run scan</Button></div>}
      />
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Total open" value="127" tone="warning" icon={Bug} />
        <StatCard label="Critical" value="14" tone="critical" icon={ShieldAlert} />
        <StatCard label="Resolved (7d)" value="43" tone="success" icon={CheckCircle2} />
        <StatCard label="Avg age" value="3.1d" tone="info" icon={Clock} />
      </div>
      <Panel className="mt-6">
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1"><Input placeholder="Search by ID, title, project…" /></div>
          <Button variant="outline" size="sm"><Filter className="h-3.5 w-3.5" /> Filters</Button>
          {["All", "Critical", "High", "Medium", "Low"].map((s, i) => (
            <Button key={s} variant={i === 0 ? "secondary" : "ghost"} size="sm">{s}</Button>
          ))}
        </div>
        <div className="-mx-6 overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-border text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                <th className="px-6 py-3 font-medium">ID</th>
                <th className="px-3 py-3 font-medium">Finding</th>
                <th className="px-3 py-3 font-medium">Project</th>
                <th className="px-3 py-3 font-medium">Scanner</th>
                <th className="px-3 py-3 font-medium">Severity</th>
                <th className="px-3 py-3 font-medium">Assignee</th>
                <th className="px-6 py-3 font-medium">Age</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border/40 transition-colors hover:bg-secondary/40">
                  <td className="px-6 py-3 font-mono text-xs text-muted-foreground">{r.id}</td>
                  <td className="px-3 py-3 font-medium">{r.title}</td>
                  <td className="px-3 py-3 font-mono text-xs text-muted-foreground">{r.project}</td>
                  <td className="px-3 py-3 text-muted-foreground">{r.scanner}</td>
                  <td className="px-3 py-3"><SeverityBadge level={r.severity} /></td>
                  <td className="px-3 py-3 text-xs text-muted-foreground">{r.assignee}</td>
                  <td className="px-6 py-3 text-xs text-muted-foreground">{r.age}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}