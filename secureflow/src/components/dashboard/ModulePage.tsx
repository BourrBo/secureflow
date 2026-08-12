import { useMemo } from "react";
import {
  countBySeverity,
  relativeTime,
  MODULE_LABEL,
  normalizeFinding,
  type ModuleKey,
} from "@/lib/security";
import { PageHeader, Panel, StatCard } from "./primitives";
import { ModuleFindingsTable } from "./ModuleFindingsTable";
import { ScanLauncher, type ScanResult } from "./ScanLauncher";
import { ExportReportButton } from "./ExportReportButton";
import { Button } from "@/components/ui/button";
import { useScanResult } from "@/lib/scanResults";
import { Bug, ShieldAlert, AlertTriangle, Clock, RotateCcw } from "lucide-react";

export function ModulePage({ module, description }: { module: ModuleKey; description: string }) {
  const name = MODULE_LABEL[module];
  /**
   * Module pages are session-scoped: results come only from the scan the user just
   * ran (the POST response), never from the persisted /api/findings aggregate.
   */
  const { result, ranAt, setResult, resetResult } = useScanResult(module);

  const findings = useMemo(
    () => (result?.findings ?? []).map((f, i) => normalizeFinding(f, i)),
    [result],
  );

  const stats = useMemo(() => {
    const c = countBySeverity(findings);
    return { total: findings.length, ...c };
  }, [findings]);

  const scanned = result !== null;

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
              ? "Point at a running target and choose a scan depth"
              : "Point at a GitHub repository or upload a local .zip archive"
        }
        className="mb-5"
      >
        <ScanLauncher
          module={module}
          onResult={(r: ScanResult) => {
            setResult(r);
          }}
        />
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
              onClick={resetResult}
              title={scanned ? "Clear this module's scan results" : "Nothing to reset yet"}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </Button>
          </div>
        }
      >
        <ModuleFindingsTable
          module={module}
          findings={findings}
          target={result?.label}
          emptyTitle={scanned ? `No ${name} findings` : "Ready to scan"}
          emptyDescription={
            scanned
              ? `This ${name} scan completed without any findings.`
              : "Enter a repository, image or target above and run a scan to see results here."
          }
        />
      </Panel>
    </>
  );
}
