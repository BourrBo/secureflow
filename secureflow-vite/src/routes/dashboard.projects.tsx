import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Panel, SeverityBadge } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { GitBranch, Plus, Star } from "lucide-react";

export const Route = createFileRoute("/dashboard/projects")({ component: Projects });

const projects = [
  { name: "api-gateway", branch: "main", scans: 142, crit: 8, high: 14, lang: "TypeScript", score: 72 },
  { name: "billing-svc", branch: "main", scans: 87, crit: 3, high: 12, lang: "Go", score: 81 },
  { name: "web-app", branch: "main", scans: 210, crit: 1, high: 7, lang: "TypeScript", score: 89 },
  { name: "infra-core", branch: "prod", scans: 56, crit: 1, high: 5, lang: "Terraform", score: 84 },
  { name: "mobile-ios", branch: "develop", scans: 34, crit: 0, high: 2, lang: "Swift", score: 93 },
];

function Projects() {
  return (
    <>
      <PageHeader eyebrow="Workspace" title="Projects" description="Every repository connected to SecureFlow across your organization."
        actions={<Button variant="hero" size="sm"><Plus className="h-3.5 w-3.5" /> Connect repo</Button>} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {projects.map((p) => (
          <Panel key={p.name} className="hover:border-primary/40">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <GitBranch className="h-4 w-4 text-primary" />
                  <span className="font-mono text-sm font-semibold">{p.name}</span>
                </div>
                <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{p.lang}</span>
                  <span>·</span>
                  <span>{p.branch}</span>
                  <span>·</span>
                  <span>{p.scans} scans</span>
                </div>
              </div>
              <div className="rounded-lg bg-primary/10 px-2 py-1 text-center">
                <div className="font-display text-lg font-bold text-primary">{p.score}</div>
                <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">score</div>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
              {p.crit > 0 && <SeverityBadge level="critical" />}
              {p.high > 0 && <SeverityBadge level="high" />}
              <span className="ml-auto text-xs text-muted-foreground">{p.crit} crit · {p.high} high</span>
            </div>
          </Panel>
        ))}
      </div>
    </>
  );
}