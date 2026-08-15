import { useRef, useState } from "react";
import { toast } from "sonner";
import { type ApiFinding } from "@/lib/api";
import { MODULE_LABEL, type ModuleKey } from "@/lib/security";
import { useDastScan } from "@/lib/dastScan";
import { REPO_BASE, useModuleScan } from "@/lib/moduleScan";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Play, Github, Upload, X } from "lucide-react";

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

export function ScanLauncher({ module }: { module: ModuleKey }) {
  const name = MODULE_LABEL[module];
  const fileInput = useRef<HTMLInputElement>(null);

  const [source, setSource] = useState<Source>("repo");
  const [value, setValue] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const dast = useDastScan();
  const moduleScan = useModuleScan(module);

  const base = REPO_BASE[module];

  const dastRunning = dast.state.status === "running";
  const moduleRunning = moduleScan.running !== null;
  const running = module === "dast" ? dastRunning : moduleRunning;

  const handleRun = () => {
    if (module === "dast") {
      if (!value.trim()) {
        toast.error("Enter a target URL.");
        return;
      }
      dast.start(value.trim());
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
            value={module === "dast" && dastRunning ? (dast.state.targetUrl ?? value) : value}
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
      </div>

      {module === "dast"
        ? dastRunning && <ScanProgressBar phase={dast.state.phase} pct={dast.state.pct} />
        : moduleRunning && <ScanProgressBar phase="Scanning…" pct={null} />}

      <p className="text-[11px] text-muted-foreground">
        {module === "dast"
          ? dastRunning
            ? "Running in the background — safe to switch tabs or navigate away, this keeps going and reconnects automatically if your connection drops."
            : "Full scan only — spider, AJAX spider and active scan, against a live target. Can take several minutes to over an hour depending on the target."
          : running
            ? "Scan in progress — this can take a few minutes for large repositories."
            : "Scans run server-side; results for this run appear below when it completes."}
      </p>
    </div>
  );
}
