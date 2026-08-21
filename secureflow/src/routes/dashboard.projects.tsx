import { useState } from "react";
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
import { projectsQuery, findingsQuery, projectScansQuery } from "@/lib/queries";
import { countBySeverity, securityScore, relativeTime, type Finding } from "@/lib/security";
import { GitBranch, Plus, FolderGit2, ChevronDown, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/dashboard/projects")({ component: Projects });

/**
 * One card = one logical project/repository. Scan history is fetched per
 * project from its own scans endpoint so every individual scan record counts
 * — SAST and SCA runs of the same repo are two scans of one project, never
 * collapsed into one and never split into two project rows.
 */
function ProjectCard({
  project,
  findings,
  findingsLoading,
}: {
  project: { id: string; name: string; language: string; branch: string; scans: number | null };
  findings: Finding[];
  findingsLoading: boolean;
}) {
  const [open, setOpen] = useState(false);
  // Scan history is only fetched when the card is expanded. Fetching it for
  // every project on first render meant 30-40 parallel /projects/{id}/scans
  // requests (~11s each) before anything useful appeared; the list endpoint
  // already carries the scan count for the collapsed state.
  const scans = useQuery({ ...projectScansQuery(project.id), enabled: open });
  const c = countBySeverity(findings);
  const score = findingsLoading ? null : securityScore(findings);
  const scanCount = scans.data ? scans.data.length : project.scans;
  const scanCountLabel =
    scanCount === null ? "— scans" : `${scanCount} scan${scanCount === 1 ? "" : "s"}`;

  return (
    <Panel className="transition-colors hover:border-primary/40">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <GitBranch className="h-3.5 w-3.5 text-primary" />
            <span className="truncate font-mono text-[13px] font-semibold">{project.name}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
            <span>{project.language}</span>
            <span>·</span>
            <span>{project.branch}</span>
            <span>·</span>
            <span>{open && scans.isLoading ? "… scans" : scanCountLabel}</span>
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
          {findingsLoading ? "…" : `${c.critical} crit · ${c.high} high · ${findings.length} total`}
        </span>
      </div>

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="mt-3 flex w-full items-center gap-1.5 rounded-md px-1 py-1 text-left font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        Scan history
      </button>
      {open && (
        <div className="mt-1 rounded-md border border-border/60">
          {scans.error ? (
            <ErrorState error={scans.error} />
          ) : scans.isLoading ? (
            <div className="p-3 text-[11px] text-muted-foreground">Loading scans…</div>
          ) : (scans.data?.length ?? 0) === 0 ? (
            <div className="p-3 text-[11px] text-muted-foreground">No scans recorded yet.</div>
          ) : (
            <ul className="divide-y divide-border/50">
              {scans.data!.map((s) => (
                <li key={s.id} className="flex items-center gap-2 px-3 py-2 text-[11px]">
                  <span className="font-medium text-foreground">{s.moduleLabel}</span>
                  <span className="text-muted-foreground">{s.status}</span>
                  <span className="text-muted-foreground">
                    {s.findings === null ? "" : `· ${s.findings} findings`}
                  </span>
                  <span className="ml-auto font-mono tabular-nums text-muted-foreground">
                    {relativeTime(s.at)}
                  </span>
                  <Link
                    to="/dashboard/findings"
                    search={{ q: "", project_id: project.id, scan_id: s.id }}
                    className="text-primary hover:underline"
                  >
                    View
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <Button asChild variant="ghost" size="sm" className="mt-3 w-full">
        <Link
          to="/dashboard/findings"
          search={{ q: "", project_id: project.id, scan_id: undefined }}
        >
          View findings
        </Link>
      </Button>
    </Panel>
  );
}

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
          {projects.data!.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              findings={byProject(p.name, p.id)}
              findingsLoading={findings.isLoading}
            />
          ))}
        </div>
      )}
    </>
  );
}
