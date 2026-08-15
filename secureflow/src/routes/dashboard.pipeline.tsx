import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  PageHeader,
  Panel,
  EmptyState,
  ErrorState,
  TableSkeleton,
  SeverityBadge,
} from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { api, API_URL, type ApiBlockingFinding, type ApiGateRun } from "@/lib/api";
import { gateRunsQuery, projectsQuery } from "@/lib/queries";
import { relativeTime } from "@/lib/security";
import { CheckCircle2, ChevronDown, Copy, GitBranch, Play, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/dashboard/pipeline")({ component: Pipeline });

const SEVERITIES = ["critical", "high", "medium", "low"] as const;

function severityLevel(s?: string): "critical" | "high" | "medium" | "low" | "info" {
  const v = (s ?? "").toLowerCase();
  if (v === "critical" || v === "high" || v === "medium" || v === "low") return v;
  return "info";
}

function CodeBlock({ label, code }: { label: string; code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-lg border border-border/70 bg-secondary/25">
      <div className="flex items-center justify-between gap-3 border-b border-border/60 px-3 py-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-[11px]"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(code);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              toast.error("Could not copy to clipboard");
            }
          }}
        >
          <Copy className="h-3 w-3" /> {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre className="overflow-x-auto p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
        {code}
      </pre>
    </div>
  );
}

function Pipeline() {
  const qc = useQueryClient();
  const projects = useQuery(projectsQuery());
  const runs = useQuery(gateRunsQuery());

  const [projectId, setProjectId] = useState<string>("");
  const [failOn, setFailOn] = useState<string[]>(["critical", "high"]);
  const [commitSha, setCommitSha] = useState("");
  const [result, setResult] = useState<
    (ApiGateRun & { blocking_findings: ApiBlockingFinding[] }) | null
  >(null);

  const evaluate = useMutation({
    mutationFn: () =>
      api.evaluateGate({
        project_id: projectId,
        fail_on: failOn.join(","),
        ...(commitSha.trim() ? { commit_sha: commitSha.trim() } : {}),
        triggered_by: "manual",
      }),
    onSuccess: (r) => {
      setResult(r);
      qc.invalidateQueries({ queryKey: ["gate-runs"] });
    },
    onError: (e) =>
      toast.error("Gate check failed", {
        description: e instanceof Error ? e.message : undefined,
      }),
  });

  const run = () => {
    if (!projectId) {
      toast.error("Choose a project.");
      return;
    }
    if (failOn.length === 0) {
      toast.error("Choose at least one severity to fail on.");
      return;
    }
    evaluate.mutate();
  };

  const apiBase = API_URL;
  const ghSnippet = `- name: SecureFlow gate
  run: |
    RESP=$(curl -sS -X POST "${apiBase}/api/gate/evaluate" \\
      -H "X-API-Key: $SECUREFLOW_API_KEY" \\
      -H "Content-Type: application/json" \\
      -d '{"project_id":"<project-id>","fail_on":"critical,high","commit_sha":"'"$GITHUB_SHA"'","triggered_by":"github-actions"}')
    echo "$RESP" | jq .
    test "$(echo "$RESP" | jq -r .passed)" = "true" || exit 1
  env:
    SECUREFLOW_API_KEY: \${{ secrets.SECUREFLOW_API_KEY }}`;

  const jenkinsSnippet = `stage('SecureFlow gate') {
  steps {
    withCredentials([string(credentialsId: 'secureflow-api-key', variable: 'SECUREFLOW_API_KEY')]) {
      sh '''
        RESP=$(curl -sS -X POST "${apiBase}/api/gate/evaluate" \\
          -H "X-API-Key: $SECUREFLOW_API_KEY" \\
          -H "Content-Type: application/json" \\
          -d "{\\"project_id\\":\\"<project-id>\\",\\"fail_on\\":\\"critical,high\\",\\"commit_sha\\":\\"$GIT_COMMIT\\",\\"triggered_by\\":\\"jenkins\\"}")
        echo "$RESP" | jq .
        test "$(echo "$RESP" | jq -r .passed)" = "true" || exit 1
      '''
    }
  }
}`;

  const gitlabSnippet = `secureflow_gate:
  stage: test
  image: alpine:latest
  before_script:
    - apk add --no-cache curl jq
  script:
    - |
      RESP=$(curl -sS -X POST "${apiBase}/api/gate/evaluate" \\
        -H "X-API-Key: $SECUREFLOW_API_KEY" \\
        -H "Content-Type: application/json" \\
        -d "{\\"project_id\\":\\"<project-id>\\",\\"fail_on\\":\\"critical,high\\",\\"commit_sha\\":\\"$CI_COMMIT_SHA\\",\\"triggered_by\\":\\"gitlab-ci\\"}")
      echo "$RESP" | jq .
      test "$(echo "$RESP" | jq -r .passed)" = "true" || exit 1`;

  const sarifSnippet = `curl -H "X-API-Key: $SECUREFLOW_API_KEY" "${apiBase}/api/gate/sarif?project_id=<project-id>" -o results.sarif`;

  return (
    <>
      <PageHeader
        eyebrow="Workspace"
        title="Pipeline"
        description="CI/CD gate history — recent evaluations that blocked or passed a build."
      />

      <div className="space-y-5">
        <Panel
          title="Run gate check"
          description="Evaluate a project's current findings against a severity threshold."
        >
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-[11px]">Project</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger className="h-9 text-[13px]">
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent>
                  {(projects.data ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px]">Commit SHA (optional)</Label>
              <Input
                value={commitSha}
                onChange={(e) => setCommitSha(e.target.value)}
                placeholder="e.g. 9f3c1a2"
                className="h-9 font-mono text-[13px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px]">Fail on</Label>
              <div className="flex flex-wrap items-center gap-3 pt-1.5">
                {SEVERITIES.map((s) => (
                  <label key={s} className="flex items-center gap-1.5 text-[12px] capitalize">
                    <Checkbox
                      checked={failOn.includes(s)}
                      onCheckedChange={(c) =>
                        setFailOn((prev) =>
                          c === true ? [...prev, s] : prev.filter((x) => x !== s),
                        )
                      }
                    />
                    {s}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4">
            <Button variant="hero" size="sm" onClick={run} disabled={evaluate.isPending}>
              <Play className="h-3.5 w-3.5" />
              {evaluate.isPending ? "Running check…" : "Run check"}
            </Button>
          </div>

          {result && (
            <div
              className={`mt-4 rounded-lg border p-4 ${
                result.passed
                  ? "border-success/40 bg-success/10"
                  : "border-critical/40 bg-critical/10"
              }`}
            >
              <div className="flex items-center gap-2">
                {result.passed ? (
                  <CheckCircle2 className="h-4 w-4 text-success" />
                ) : (
                  <ShieldAlert className="h-4 w-4 text-critical" />
                )}
                <span
                  className={`text-[13px] font-semibold ${result.passed ? "text-success" : "text-critical"}`}
                >
                  {result.passed
                    ? "Passed — 0 blocking findings"
                    : `Blocked — ${result.blocking_count} blocking findings`}
                </span>
              </div>
              {!result.passed && (result.blocking_findings?.length ?? 0) > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {result.blocking_findings.slice(0, 10).map((f) => (
                    <li key={String(f.id)} className="flex items-center gap-2 text-[12px]">
                      <SeverityBadge level={severityLevel(f.severity)} />
                      <span className="truncate">{f.title ?? `Finding ${f.id}`}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Panel>

        <Panel title="Gate history" description="Newest evaluations first.">
          {runs.error ? (
            <ErrorState error={runs.error} />
          ) : runs.isLoading ? (
            <TableSkeleton rows={5} cols={6} />
          ) : (runs.data?.length ?? 0) === 0 ? (
            <EmptyState
              icon={GitBranch}
              title="No gate runs yet"
              description="Run a gate check above, or wire SecureFlow into your CI pipeline."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[12px]">
                <thead>
                  <tr className="border-b border-border/60 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    <th className="py-2 pr-3 font-normal">Project</th>
                    <th className="py-2 pr-3 font-normal">Result</th>
                    <th className="py-2 pr-3 font-normal">Blocking / total</th>
                    <th className="py-2 pr-3 font-normal">Fail on</th>
                    <th className="py-2 pr-3 font-normal">Commit</th>
                    <th className="py-2 pr-3 font-normal">Triggered by</th>
                    <th className="py-2 font-normal">When</th>
                  </tr>
                </thead>
                <tbody>
                  {[...(runs.data ?? [])]
                    .sort(
                      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
                    )
                    .map((r) => (
                      <tr key={String(r.id)} className="border-b border-border/40">
                        <td className="py-2 pr-3 font-mono">
                          {r.project_name ?? `Project ${r.project_id}`}
                        </td>
                        <td className="py-2 pr-3">
                          <span
                            className={`inline-flex items-center rounded-md border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] ${
                              r.passed
                                ? "border-success/40 bg-success/10 text-success"
                                : "border-critical/40 bg-critical/10 text-critical"
                            }`}
                          >
                            {r.passed ? "passed" : "blocked"}
                          </span>
                        </td>
                        <td className="py-2 pr-3 font-mono tabular-nums">
                          {r.blocking_count} / {r.total_findings}
                        </td>
                        <td className="py-2 pr-3 font-mono">{r.fail_on}</td>
                        <td className="py-2 pr-3 font-mono">
                          {r.commit_sha ? r.commit_sha.slice(0, 8) : "—"}
                        </td>
                        <td className="py-2 pr-3">{r.triggered_by ?? "manual"}</td>
                        <td className="py-2 text-muted-foreground">
                          {relativeTime(r.created_at ? new Date(r.created_at) : null)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Collapsible>
          <Panel>
            <CollapsibleTrigger className="group flex w-full items-center justify-between gap-3 text-left">
              <div>
                <h3 className="font-display text-sm font-semibold tracking-tight">
                  Wire this into your pipeline
                </h3>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Fail the build when the gate reports blocking findings.
                </p>
              </div>
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-4 space-y-3">
              <CodeBlock label="GitHub Actions" code={ghSnippet} />
              <CodeBlock label="Jenkinsfile" code={jenkinsSnippet} />
              <CodeBlock label="GitLab CI" code={gitlabSnippet} />
              <CodeBlock label="Fetch SARIF" code={sarifSnippet} />
            </CollapsibleContent>
          </Panel>
        </Collapsible>
      </div>
    </>
  );
}
