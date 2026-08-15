import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { api, type ApiFinding } from "./api";
import { MODULE_LABEL, type ModuleKey } from "./security";
import { useScanResults } from "./scanResults";
import { useNotifications } from "./notifications";

/** git-based modules share one repo-url / zip-upload shape. */
export const REPO_BASE: Partial<Record<ModuleKey, "sast" | "sca" | "iac" | "secrets">> = {
  sast: "sast",
  sca: "sca", // dedicated Trivy-backed SCA endpoints
  iac: "iac",
  secrets: "secrets",
};

export type ModuleScanPayload =
  | { source: "repo"; value: string }
  | { source: "zip"; file: File }
  | { source: "image"; value: string };

type Running = { label: string; startedAt: string };

type Ctx = {
  running: Partial<Record<ModuleKey, Running>>;
  start: (module: ModuleKey, payload: ModuleScanPayload) => void;
};

const ModuleScanContext = createContext<Ctx | null>(null);

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

/**
 * Holds in-flight scans for the synchronous modules (SAST/SCA/IaC/Secrets/
 * Container) at the dashboard layout level, so navigating between module
 * pages no longer tears down the request the way ScanLauncher's local
 * mutation did. These endpoints are synchronous and expose no scan_id or
 * progress, so the run cannot be resumed after a full page reload — it is
 * deliberately not persisted; only the completed result is (scanResults).
 */
export function ModuleScanProvider({ children }: { children: ReactNode }) {
  const [running, setRunning] = useState<Partial<Record<ModuleKey, Running>>>({});
  const { set: setResult } = useScanResults();
  const { push } = useNotifications();
  const inflight = useRef<Set<ModuleKey>>(new Set());

  const start = useCallback(
    (module: ModuleKey, payload: ModuleScanPayload) => {
      if (inflight.current.has(module)) return;
      const name = MODULE_LABEL[module];
      const label = payload.source === "zip" ? payload.file.name : payload.value;
      inflight.current.add(module);
      setRunning((prev) => ({ ...prev, [module]: { label, startedAt: new Date().toISOString() } }));
      push({ kind: "info", title: `${name} scan started`, description: label });

      void (async () => {
        try {
          let res: unknown;
          if (module === "container") {
            if (payload.source !== "image") throw new Error("Enter a container image reference.");
            res = await api.scanContainer(payload.value);
          } else {
            const base = REPO_BASE[module];
            if (!base) throw new Error("Unsupported module.");
            res =
              payload.source === "zip"
                ? await api.scanLocal(base, payload.file)
                : await api.scanRepo(base, payload.value);
          }
          const findings = extractFindings(res);
          setResult(module, { findings, label });
          toast.success(`${name} scan complete`, {
            description: `${findings.length} finding${findings.length === 1 ? "" : "s"} returned.`,
          });
          push({
            kind: "success",
            title: `${name} scan complete`,
            description: `${label} — ${findings.length} finding${findings.length === 1 ? "" : "s"}`,
          });
        } catch (e) {
          const message = e instanceof Error ? e.message : "Unexpected error.";
          toast.error(`${name} scan failed`, { description: message });
          push({ kind: "error", title: `${name} scan failed`, description: message });
        } finally {
          inflight.current.delete(module);
          setRunning((prev) => {
            const next = { ...prev };
            delete next[module];
            return next;
          });
        }
      })();
    },
    [push, setResult],
  );

  const value = useMemo(() => ({ running, start }), [running, start]);
  return <ModuleScanContext.Provider value={value}>{children}</ModuleScanContext.Provider>;
}

export function useModuleScan(module: ModuleKey) {
  const ctx = useContext(ModuleScanContext);
  if (!ctx) throw new Error("useModuleScan must be used inside <ModuleScanProvider>");
  return {
    running: ctx.running[module] ?? null,
    start: (payload: ModuleScanPayload) => ctx.start(module, payload),
  };
}

export function useRunningScans() {
  const ctx = useContext(ModuleScanContext);
  if (!ctx) throw new Error("useRunningScans must be used inside <ModuleScanProvider>");
  return ctx.running;
}
