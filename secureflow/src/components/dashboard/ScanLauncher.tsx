import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, type ApiFinding, type DastMode } from "@/lib/api";
import { MODULE_LABEL, type ModuleKey } from "@/lib/security";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

function formatElapsed(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

const DAST_POLL_INTERVAL_MS = 4000;
// A handful of consecutive failed polls (~32s) tolerates a brief tunnel
// hiccup without giving up — but if the backend is genuinely unreachable
// for a long stretch, stop polling instead of doing it forever.
const DAST_MAX_CONSECUTIVE_POLL_FAILURES = 8;

/**
 * Polls GET /api/dast/scan/{scanId} until the scan finishes. Each poll is a
 * short request, so unlike the old single long-blocking POST, a tunnel
 * (ngrok, etc.) dropping one idle connection doesn't lose the whole scan —
 * the next poll a few seconds later just picks the result back up. The scan
 * itself keeps running on the backend regardless of what the frontend is
 * doing, so recovering it is purely a matter of asking again.
 */
async function pollDastScan(
  scanId: string | number,
  onTick?: (elapsedSec: number) => void,
): Promise<ApiFinding[]> {
  const start = Date.now();
  let consecutiveFailures = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    await new Promise((resolve) => setTimeout(resolve, DAST_POLL_INTERVAL_MS));
    onTick?.(Math.round((Date.now() - start) / 1000));

    let statusRes;
    try {
      statusRes = await api.getDastScanStatus(scanId);
      consecutiveFailures = 0;
    } catch (e) {
      consecutiveFailures += 1;
      if (consecutiveFailures >= DAST_MAX_CONSECUTIVE_POLL_FAILURES) {
        throw new Error(
          `Lost connection while checking on scan #${scanId}. It may still be running on the backend — check the Reports page in a few minutes.`,
        );
      }
      continue; // transient network hiccup — try again next tick
    }

    if (statusRes.status === "completed") {
      return statusRes.findings ?? [];
    }
    if (statusRes.status === "failed") {
      throw new Error(statusRes.error || "DAST scan failed.");
    }
    // status === "running" — keep polling
  }
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
  const [mode, setMode] = useState<DastMode>("standard");
  const [dastElapsedSec, setDastElapsedSec] = useState(0);

  const base = REPO_BASE[module];

  const mutation = useMutation({
    mutationFn: async () => {
      if (module === "container") {
        if (!value.trim()) throw new Error("Enter a container image reference.");
        return { res: await api.scanContainer(value.trim()), label: value.trim() };
      }
      if (module === "dast") {
        if (!value.trim()) throw new Error("Enter a target URL.");
        const target = value.trim();
        const started = await api.scanDast(target, mode);
        setDastElapsedSec(0);
        const findings = await pollDastScan(started.scan_id, setDastElapsedSec);
        return { res: findings, label: target };
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

  const running = mutation.isPending;

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
            value={value}
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

        {module === "dast" && (
          <Select value={mode} onValueChange={(v) => setMode(v as DastMode)} disabled={running}>
            <SelectTrigger className="h-9 w-[150px] text-[13px]" aria-label="Scan mode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="quick">Quick</SelectItem>
              <SelectItem value="standard">Standard</SelectItem>
              <SelectItem value="full">Full</SelectItem>
            </SelectContent>
          </Select>
        )}

        <Button
          variant="hero"
          size="sm"
          disabled={running}
          onClick={() => mutation.mutate()}
          className="shrink-0"
        >
          {running ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Play className="h-3.5 w-3.5" />
          )}
          {running
            ? module === "dast"
              ? `Scanning… ${formatElapsed(dastElapsedSec)}`
              : "Scanning…"
            : `Run ${name} scan`}
        </Button>
      </div>

      <p className="text-[11px] text-muted-foreground">
        {module === "sca"
          ? "SCA results are generated together with a SAST scan — one run produces both."
          : module === "dast"
            ? running
              ? "Scanning in the background — this tab checks in every few seconds, so it's safe to leave open even on a flaky connection."
              : "Active scanning runs against a live target and can take several minutes."
            : running
              ? "Scan in progress — this can take a few minutes for large repositories."
              : "Scans run server-side; results for this run appear below when it completes."}
      </p>
    </div>
  );
}
