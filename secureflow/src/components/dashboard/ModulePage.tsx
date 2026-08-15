import { useMemo, useState } from "react";
import {
  countBySeverity,
  relativeTime,
  MODULE_LABEL,
  normalizeFinding,
  type ModuleKey,
} from "@/lib/security";
import { PageHeader, Panel, StatCard } from "./primitives";
import { ModuleFindingsTable } from "./ModuleFindingsTable";
import { ScanLauncher } from "./ScanLauncher";
import { ExportReportButton } from "./ExportReportButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useScanResult } from "@/lib/scanResults";
import { Bug, ShieldAlert, AlertTriangle, Clock, RotateCcw, Search } from "lucide-react";

export function ModulePage({ module, description }: { module: ModuleKey; description: string }) {
  const name = MODULE_LABEL[module];

  /**
   * Module pages are session-scoped: results come only from the scan the user just
   * ran (the POST response), never from the persisted /api/findings aggregate.
   */
  const { result, ranAt, resetResult } = useScanResult(module);

  const [query, setQuery] = useState("");

  const findings = useMemo(
    () => (result?.findings ?? []).map((f, i) => normalizeFinding(f, i)),
    [result],
  );

  const filteredFindings = useMemo(() => {
    if (!query.trim()) return findings;
    const q = query.toLowerCase();
    return findings.filter((f) => {
      const hay = [f.title, f.file, f.description, f.cwe, f.cve, f.rule, f.owasp]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [findings, query]);

  const stats = useMemo(() => {
    const c = countBySeverity(findings);
    return { total: findings.length, ...c };
  }, [findings]);

  const scanned = result !== null;

  const handleReset = () => {
    setQuery("");
    resetResult();
  };

  return (
    <>
      <PageHeader
        eyebrow={`Module · ${name}`}
        title={`${name} analysis`}
        description={description}
      />
      <Panel
        title={`Run a ${name} scan`}
        description={
          module === "container"
            ? "Point at a container image reference to analyse its layers"
            : module === "dast"
              ? "Point at a running target to run a full DAST assessment"
              : "Point at a GitHub repository or upload a local .zip archive"
        }
        className="mb-5"
      >
        <ScanLauncher module={module} />
      </Panel>
      <div className="grid gap-3 md:grid-cols-4">
        <StatCard
          label="Findings this scan"
          value={scanned ? stats.total : "—"}
          tone="info"
          icon={Bug}
        />
        <StatCard
          label="Critical"
          value={scanned ? stats.critical : "—"}
          tone="critical"
          icon={ShieldAlert}
        />
        <StatCard
          label="High"
          value={scanned ? stats.high : "—"}
          tone="warning"
          icon={AlertTriangle}
        />
        <StatCard
          label="Latest result"
          value={scanned ? relativeTime(ranAt) : "—"}
          tone="success"
          icon={Clock}
        />
      </div>
      <Panel
        title={`${name} findings`}
        description={
          scanned
            ? `Results from this session's scan${result?.label ? ` — ${result.label}` : ""}`
            : "Results from the scan you run in this session"
        }
        className="mt-5"
        actions={
          <div className="flex items-center gap-2">
            <ExportReportButton
              findings={result?.findings ?? []}
              scanType={module}
              repoLabel={result?.label ?? ""}
            />
            <Button
              variant="outline"
              size="sm"
              disabled={!scanned}
              onClick={handleReset}
              title={scanned ? "Clear this module's scan results" : "Nothing to reset yet"}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </Button>
          </div>
        }
      >
        {scanned && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${name} results...`}
                className="h-9 pl-9 text-[13px]"
              />
              {query && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground hover:text-foreground"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        )}
        <ModuleFindingsTable
          module={module}
          findings={filteredFindings}
          target={result?.label}
          emptyTitle={scanned ? `No ${name} findings` : "Ready to scan"}
          emptyDescription={
            scanned
              ? query.trim()
                ? `No ${name} results match "${query.trim()}". Try a different term.`
                : `This ${name} scan completed without any findings.`
              : "Enter a repository, image or target above and run a scan to see results here."
          }
        />
      </Panel>
    </>
  );
}
