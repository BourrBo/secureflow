import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  PageHeader,
  Panel,
  CardsSkeleton,
  EmptyState,
  ErrorState,
  SeverityBadge,
} from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { projectsQuery, findingsQuery } from "@/lib/queries";
import { countBySeverity, securityScore } from "@/lib/security";
import { GitBranch, Plus, FolderGit2 } from "lucide-react";

export const Route = createFileRoute("/dashboard/projects")({ component: Projects });

function Projects() {
  const projects = useQuery(projectsQuery());
  const findings = useQuery(findingsQuery());

  const byProject = (name: string, id: string) =>
    (findings.data ?? []).filter((f) => f.project === name || f.project === id);

  return (
    <>
      <PageHeader
        eyebrow="Workspace"
        title="Projects"
        description="Every repository connected to SecureFlow, with live posture per project."
        actions={
          <Button variant="hero" size="sm">
            <Plus className="h-3.5 w-3.5" /> Connect repo
          </Button>
        }
      />
      {projects.error ? (
        <ErrorState error={projects.error} />
      ) : projects.isLoading ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <CardsSkeleton count={6} height={128} />
        </div>
      ) : (projects.data?.length ?? 0) === 0 ? (
        <EmptyState
          icon={FolderGit2}
          title="No projects connected"
          description="Connect your first repository to start scanning code, dependencies, infrastructure and containers."
          action={
            <Button variant="hero" size="sm">
              <Plus className="h-3.5 w-3.5" /> Connect repo
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {projects.data!.map((p) => {
            const list = byProject(p.name, p.id);
            const c = countBySeverity(list);
            const score = findings.isLoading ? null : securityScore(list);
            return (
              <Panel key={p.id} className="transition-colors hover:border-primary/40">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <GitBranch className="h-3.5 w-3.5 text-primary" />
                      <span className="truncate font-mono text-[13px] font-semibold">{p.name}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                      <span>{p.language}</span>
                      <span>·</span>
                      <span>{p.branch}</span>
                      {p.scans !== null && (
                        <>
                          <span>·</span>
                          <span>{p.scans} scans</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="rounded-lg bg-primary/10 px-2 py-1 text-center ring-1 ring-primary/20">
                    <div className="font-display text-base font-semibold tabular-nums text-primary">
                      {score ?? "—"}
                    </div>
                    <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                      score
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-1.5">
                  {c.critical > 0 && <SeverityBadge level="critical" />}
                  {c.high > 0 && <SeverityBadge level="high" />}
                  <span className="ml-auto font-mono text-[11px] tabular-nums text-muted-foreground">
                    {findings.isLoading
                      ? "…"
                      : `${c.critical} crit · ${c.high} high · ${list.length} total`}
                  </span>
                </div>
                <Button asChild variant="ghost" size="sm" className="mt-3 w-full">
                  <Link to="/dashboard/findings">View findings</Link>
                </Button>
              </Panel>
            );
          })}
        </div>
      )}
    </>
  );
}
