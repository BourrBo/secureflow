import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { type ApiFinding, type DastMode, type DastAttackStrength } from "@/lib/api";
import { MODULE_LABEL, type ModuleKey } from "@/lib/security";
import { useDastScan } from "@/lib/dastScan";
import { REPO_BASE, useModuleScan } from "@/lib/moduleScan";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  Play,
  Github,
  Upload,
  X,
  Radar,
  Clock,
  AlertTriangle,
  Ban,
  ShieldCheck,
} from "lucide-react";

type Source = "repo" | "zip";

export type ScanResult = { findings: ApiFinding[]; label: string };

/** Human label for a DAST phase key, e.g. "active scan" -> "Active scan". */
function phaseLabel(phase: string | null): string {
  if (!phase) return "Starting…";
  if (phase === "starting") return "Starting…";
  if (phase === "complete") return "Complete";
  return phase.charAt(0).toUpperCase() + phase.slice(1);
}

/**
 * Real progress only: a percentage is rendered exclusively when the backend
 * reports one (DAST). Synchronous modules get an honest indeterminate bar.
 */
function ScanProgressBar({ phase, pct }: { phase: string | null; pct: number | null }) {
  const hasPct = typeof pct === "number";
  return (
    <div className="w-full">
      <div className="mb-1 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
        <span>{phaseLabel(phase)}</span>
        {hasPct && <span className="tabular-nums">{pct}%</span>}
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
        {hasPct ? (
          <div
            className="h-full rounded-full bg-[image:var(--gradient-primary)] transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        ) : (
          <div className="h-full w-1/3 animate-[pulse_1.5s_ease-in-out_infinite] rounded-full bg-[image:var(--gradient-primary)]" />
        )}
      </div>
    </div>
  );
}

type ActiveScanTelemetry = {
  state: string | null;
  requests: number | null;
  progress: number | null;
  alerts: number | null;
};

/** True once the backend reports the active-scan phase. */
function isActiveScanPhase(phase: string | null): boolean {
  return !!phase && phase.toLowerCase().includes("active");
}

const numberFmt = new Intl.NumberFormat("en-US");

/** mm:ss (or h:mm:ss) elapsed since a start timestamp. */
function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/** Ticking elapsed-time label; null start renders an em dash. */
function Elapsed({ startedAt }: { startedAt: number | null }) {
  const [, force] = useState(0);
  useEffect(() => {
    if (startedAt === null) return;
    const id = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  return <>{startedAt === null ? "—" : formatElapsed(Date.now() - startedAt)}</>;
}

/**
 * ZAP's active-scan percentage can legitimately sit at 0% for a long time
 * while thousands of requests are being processed, so we never present it
 * as the primary progress signal. Instead we show the real telemetry the
 * backend does report (state, requests, alerts) plus an honest
 * indeterminate scanning indicator.
 */
function ActiveScanCard({
  telemetry,
  startedAt,
  attackStrength,
}: {
  telemetry: ActiveScanTelemetry | null;
  startedAt: number | null;
  attackStrength: DastAttackStrength | null;
}) {
  return (
    <div className="w-full rounded-lg border border-border/70 bg-secondary/20 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          <Radar className="h-3 w-3 animate-pulse text-primary" />
          Active Scan
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-primary">
          {telemetry?.state ?? "RUNNING"}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            Requests processed
          </div>
          <div className="font-display text-sm tabular-nums">
            {typeof telemetry?.requests === "number" ? numberFmt.format(telemetry.requests) : "—"}
          </div>
        </div>
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            Alerts found
          </div>
          <div className="font-display text-sm tabular-nums">
            {typeof telemetry?.alerts === "number" ? numberFmt.format(telemetry.alerts) : "—"}
          </div>
        </div>
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            Elapsed
          </div>
          <div className="font-display text-sm tabular-nums">
            <Elapsed startedAt={startedAt} />
          </div>
        </div>
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            Attack strength
          </div>
          <div className="font-display text-sm">{attackStrength}</div>
        </div>
      </div>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
        <div className="h-full w-1/3 animate-[pulse_1.5s_ease-in-out_infinite] rounded-full bg-[image:var(--gradient-primary)]" />
      </div>
      <p className="mt-1.5 text-[11px] text-muted-foreground">
        Scanning… ZAP can report 0% while thousands of requests are already sent, so progress is
        shown as work completed
        {typeof telemetry?.progress === "number" ? ` (ZAP reports ${telemetry.progress}%)` : ""}.
      </p>
    </div>
  );
}

/** Small labelled status strip used for AJAX spider / coverage / outcome notes. */
function StatusNote({
  icon: Icon,
  tone,
  children,
}: {
  icon: typeof Radar;
  tone: "warning" | "critical" | "muted" | "success";
  children: ReactNode;
}) {
  const toneClass =
    tone === "warning"
      ? "border-warning/40 bg-warning/10 text-warning"
      : tone === "critical"
        ? "border-critical/40 bg-critical/10 text-critical"
        : tone === "success"
          ? "border-border/70 bg-secondary/20 text-muted-foreground"
          : "border-border/70 bg-secondary/20 text-muted-foreground";
  return (
    <div
      className={`flex w-full items-start gap-2 rounded-lg border px-3 py-2 text-[12px] ${toneClass}`}
    >
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

export function ScanLauncher({ module }: { module: ModuleKey }) {
  const name = MODULE_LABEL[module];
  const fileInput = useRef<HTMLInputElement>(null);

  const [source, setSource] = useState<Source>("repo");
  const [value, setValue] = useState("");
  const [attackStrength, setAttackStrength] = useState<DastAttackStrength>("MEDIUM");
  const [file, setFile] = useState<File | null>(null);

  const dast = useDastScan();
  const moduleScan = useModuleScan(module);

  const base = REPO_BASE[module];

  const dastRunning = dast.state.status === "running";
  const dastQueued = dast.state.status === "queued";
  const dastInFlight = dastRunning || dastQueued;
  const moduleRunning = moduleScan.running !== null;
  const running = module === "dast" ? dastInFlight : moduleRunning;

  const handleRun = () => {
    if (module === "dast") {
      if (!value.trim()) {
        toast.error("Enter a target URL.");
        return;
      }
      if (attackStrength === "INSANE") {
        toast.warning("Starting an INSANE-strength scan", {
          description: "This can take hours and send tens of thousands of requests.",
        });
      }
      dast.start(value.trim(), "full", attackStrength);
      return;
    }
    if (module === "container") {
      if (!value.trim()) {
        toast.error("Enter a container image reference.");
        return;
      }
      moduleScan.start({ source: "image", value: value.trim() });
      return;
    }
    if (source === "zip") {
      if (!file) {
        toast.error("Choose a .zip archive to upload.");
        return;
      }
      moduleScan.start({ source: "zip", file });
      return;
    }
    if (!value.trim()) {
      toast.error("Enter a GitHub repository URL.");
      return;
    }
    moduleScan.start({ source: "repo", value: value.trim() });
  };

  return (
    <div className="flex flex-col gap-3">
      {base && (
        <div className="flex items-center gap-1 self-start rounded-lg border border-border/70 bg-secondary/20 p-1">
          {(
            [
              { v: "repo" as const, label: "GitHub URL", icon: Github },
              { v: "zip" as const, label: "Upload zip", icon: Upload },
            ] satisfies Array<{ v: Source; label: string; icon: typeof Github }>
          ).map((t) => (
            <button
              key={t.v}
              type="button"
              disabled={running}
              onClick={() => setSource(t.v)}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors disabled:opacity-50 ${
                source === t.v
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <t.icon className="h-3 w-3" />
              {t.label}
            </button>
          ))}
        </div>
      )}

      {module === "dast" && (
        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            Attack strength
          </span>
          <div className="flex items-center gap-1 self-start rounded-lg border border-border/70 bg-secondary/20 p-1">
            {(["LOW", "MEDIUM", "HIGH", "INSANE"] as DastAttackStrength[]).map((s) => (
              <button
                key={s}
                type="button"
                disabled={running}
                onClick={() => setAttackStrength(s)}
                className={`rounded-md px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors disabled:opacity-50 ${
                  attackStrength === s
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          {attackStrength === "INSANE" && (
            <StatusNote icon={AlertTriangle} tone="warning">
              INSANE sends tens of thousands of requests per target and can take hours to finish.
              Only use it against a target you're prepared to have scanned exhaustively for that
              long.
            </StatusNote>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {base && source === "zip" ? (
          <>
            <input
              ref={fileInput}
              type="file"
              accept=".zip,application/zip"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={running}
              onClick={() => fileInput.current?.click()}
            >
              <Upload className="h-3.5 w-3.5" /> Choose .zip
            </Button>
            {file && (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-border/70 bg-secondary/20 px-2 py-1 font-mono text-[11px] text-muted-foreground">
                {file.name}
                <button
                  type="button"
                  aria-label="Remove file"
                  onClick={() => {
                    setFile(null);
                    if (fileInput.current) fileInput.current.value = "";
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
          </>
        ) : (
          <Input
            value={module === "dast" && dastInFlight ? (dast.state.targetUrl ?? value) : value}
            disabled={running}
            onChange={(e) => setValue(e.target.value)}
            placeholder={
              module === "container"
                ? "Container image — e.g. nginx:latest"
                : module === "dast"
                  ? "Target URL — e.g. https://staging.example.com"
                  : "https://github.com/org/repo"
            }
            aria-label={
              module === "container"
                ? "Container image reference"
                : module === "dast"
                  ? "Target URL"
                  : "GitHub repository URL"
            }
            className="h-9 min-w-[240px] flex-1 text-[13px]"
          />
        )}

        <Button
          variant="hero"
          size="sm"
          disabled={running}
          onClick={handleRun}
          className="shrink-0"
        >
          {running ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Play className="h-3.5 w-3.5" />
          )}
          {running ? "Scanning…" : `Run ${name} scan`}
        </Button>

        {module === "dast" && dastInFlight && dast.state.scanId !== null && (
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            disabled={dast.state.cancelRequested}
            onClick={() => void dast.cancel()}
          >
            <Ban className="h-3.5 w-3.5" />
            {dast.state.cancelRequested ? "Cancelling…" : "Cancel scan"}
          </Button>
        )}
      </div>

      {module === "dast"
        ? dastInFlight &&
          (dastQueued ? (
            <StatusNote icon={Clock} tone="muted">
              Waiting for scanner — another scan is in progress. This scan is queued and will start
              automatically.
            </StatusNote>
          ) : isActiveScanPhase(dast.state.phase) ? (
            <ActiveScanCard
              telemetry={dast.state.activeScan}
              startedAt={dast.state.startedAt}
              attackStrength={dast.state.attackStrength}
            />
          ) : (
            <ScanProgressBar phase={dast.state.phase} pct={dast.state.pct} />
          ))
        : moduleRunning && <ScanProgressBar phase="Scanning…" pct={null} />}

      {module === "dast" && (
        <>
          {dast.state.status === "timed_out" && (
            <StatusNote icon={AlertTriangle} tone="warning">
              Partial results — scan hit its safety timeout.
              {dast.state.error ? ` ${dast.state.error}` : ""}
            </StatusNote>
          )}
          {dast.state.status === "cancelled" && (
            <StatusNote icon={Ban} tone="muted">
              Scan cancelled by user.{dast.state.error ? ` ${dast.state.error}` : ""}
            </StatusNote>
          )}
          {dast.state.ajaxSpiderStatus === "failed_to_start" && (
            <StatusNote icon={AlertTriangle} tone="warning">
              AJAX Spider: Failed — the AJAX spider did not start, so client-rendered routes may be
              under-covered.
            </StatusNote>
          )}
          {dast.state.ajaxSpiderStatus === "timed_out" && (
            <StatusNote icon={Clock} tone="warning">
              AJAX Spider: Timed out — crawling was cut short.
            </StatusNote>
          )}
          {dast.state.scannerCoverage && (
            <StatusNote
              icon={ShieldCheck}
              tone={dast.state.scannerCoverage.includes("degraded") ? "warning" : "muted"}
            >
              Scanner coverage: {dast.state.scannerCoverage}
            </StatusNote>
          )}
        </>
      )}

      <p className="text-[11px] text-muted-foreground">
        {module === "dast"
          ? dastQueued
            ? "Queued behind another scan — this page keeps polling and will pick up automatically when it starts."
            : dastRunning
              ? "Running in the background — safe to switch tabs or navigate away, this keeps going and reconnects automatically if your connection drops."
              : "Full scan only — spider, AJAX spider and active scan, against a live target. Can take several minutes to over an hour depending on the target."
          : running
            ? "Scan in progress — this can take a few minutes for large repositories."
            : "Scans run server-side; results for this run appear below when it completes."}
      </p>
    </div>
  );
}
