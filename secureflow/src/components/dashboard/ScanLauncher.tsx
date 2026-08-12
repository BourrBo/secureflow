import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, type ApiFinding } from "@/lib/api";
import { MODULE_LABEL, type ModuleKey } from "@/lib/security";
import { useDastScan } from "@/lib/dastScan";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Play, Github, Upload, X } from "lucide-react";

/** git-based modules share one repo-url / zip-upload shape. */
const REPO_BASE: Partial<Record<ModuleKey, "sast" | "iac" | "secrets">> = {
  sast: "sast",
  sca: "sast", // SCA results are produced by the same backend call as SAST
  iac: "iac",
  secrets: "secrets",
};

type Source = "repo" | "zip";

export type ScanResult = { findings: ApiFinding[]; label: string };

/** Scan endpoints return the findings for that run directly. */
function extractFindings(res: unknown): ApiFinding[] {
  if (Array.isArray(res)) return res as ApiFinding[];
  if (res && typeof res === "object") {
    const r = res as Record<string, unknown>;
    for (const key of ["findings", "results", "vulnerabilities", "issues"]) {
      if (Array.isArray(r[key])) return r[key] as ApiFinding[];
    }
  }
  return [];
}

/** Human label for a DAST phase key, e.g. "active scan" -> "Active scan". */
function phaseLabel(phase: string | null): string {
  if (!phase) return "Starting…";
  if (phase === "starting") return "Starting…";
  if (phase === "complete") return "Complete";
  return phase.charAt(0).toUpperCase() + phase.slice(1);
}

function DastProgressBar({ phase, pct }: { phase: string | null; pct: number | null }) {
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

export function ScanLauncher({
  module,
  onResult,
}: {
  module: ModuleKey;
  onResult?: (result: ScanResult) => void;
}) {
  const name = MODULE_LABEL[module];
  const fileInput = useRef<HTMLInputElement>(null);

  const [source, setSource] = useState<Source>("repo");
  const [value, setValue] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const dast = useDastScan();

  const base = REPO_BASE[module];

  const mutation = useMutation({
    mutationFn: async () => {
      if (module === "container") {
        if (!value.trim()) throw new Error("Enter a container image reference.");
        return { res: await api.scanContainer(value.trim()), label: value.trim() };
      }
      if (!base) throw new Error("Unsupported module.");
      if (source === "zip") {
        if (!file) throw new Error("Choose a .zip archive to upload.");
        return { res: await api.scanLocal(base, file), label: file.name };
      }
      if (!value.trim()) throw new Error("Enter a GitHub repository URL.");
      return { res: await api.scanRepo(base, value.trim()), label: value.trim() };
    },
    onSuccess: ({ res, label }) => {
      const findings = extractFindings(res);
      toast.success(`${name} scan complete`, {
        description: `${findings.length} finding${findings.length === 1 ? "" : "s"} returned.`,
      });
      onResult?.({ findings, label });
    },
    onError: (e: unknown) => {
      toast.error(`${name} scan failed`, {
        description: e instanceof Error ? e.message : "Unexpected error.",
      });
    },
  });

  const dastRunning = dast.state.status === "running";
  const running = module === "dast" ? dastRunning : mutation.isPending;

  const handleRun = () => {
    if (module === "dast") {
      if (!value.trim()) {
        toast.error("Enter a target URL.");
        return;
      }
      dast.start(value.trim());
      return;
    }
    mutation.mutate();
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

      {module === "dast" && dastRunning && (
        <DastProgressBar phase={dast.state.phase} pct={dast.state.pct} />
      )}

      <p className="text-[11px] text-muted-foreground">
        {module === "sca"
          ? "SCA results are generated together with a SAST scan — one run produces both."
          : module === "dast"
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
