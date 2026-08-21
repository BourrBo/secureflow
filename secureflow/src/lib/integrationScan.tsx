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
import { api } from "./api";
import { useNotifications } from "./notifications";

export type IntegrationScanKind = "github" | "gitlab" | "registry";

export type IntegrationScanKey = string;

type Running = { label: string; startedAt: string };
type Finished = { label: string; count: number; finishedAt: string; ok: boolean };

type Ctx = {
  running: Record<IntegrationScanKey, Running>;
  results: Record<IntegrationScanKey, Finished>;
  start: (args: {
    kind: IntegrationScanKind;
    organizationId: number;
    integrationId: number;
    label: string;
  }) => void;
};

const IntegrationScanContext = createContext<Ctx | null>(null);

export function integrationScanKey(
  kind: IntegrationScanKind,
  organizationId: number,
  integrationId: number,
): IntegrationScanKey {
  return `${kind}:${organizationId}:${integrationId}`;
}

/**
 * Same background-scan model the SAST/SCA/IaC/Secrets/Container modules use
 * (src/lib/moduleScan.tsx), applied to integration-triggered scans. The
 * request lives at the dashboard layout level, so navigating away from
 * Integrations no longer tears it down — coming back reconnects to the run
 * already in flight instead of offering to start a second one. These
 * endpoints are synchronous and return no scan_id, so (like moduleScan) the
 * run is not resumable across a full page reload.
 */
export function IntegrationScanProvider({ children }: { children: ReactNode }) {
  const [running, setRunning] = useState<Record<IntegrationScanKey, Running>>({});
  const [results, setResults] = useState<Record<IntegrationScanKey, Finished>>({});
  const { push } = useNotifications();
  const inflight = useRef<Set<IntegrationScanKey>>(new Set());

  const start = useCallback<Ctx["start"]>(
    ({ kind, organizationId, integrationId, label }) => {
      const key = integrationScanKey(kind, organizationId, integrationId);
      if (inflight.current.has(key)) return;
      inflight.current.add(key);
      setRunning((prev) => ({ ...prev, [key]: { label, startedAt: new Date().toISOString() } }));
      push({ kind: "info", title: "Integration scan started", description: label });

      void (async () => {
        try {
          const res =
            kind === "github"
              ? await api.scanGithubRepository(organizationId, integrationId)
              : kind === "gitlab"
                ? await api.scanGitlabRepository(organizationId, integrationId)
                : await api.scanRegistryImage(organizationId, integrationId);
          const count = Array.isArray(res.findings) ? res.findings.length : 0;
          const target = "image" in res && res.image ? res.image : label;
          setResults((prev) => ({
            ...prev,
            [key]: { label: target, count, finishedAt: new Date().toISOString(), ok: true },
          }));
          const description = `${target} — ${count} finding${count === 1 ? "" : "s"}`;
          toast.success("Integration scan complete", { description });
          push({ kind: "success", title: "Integration scan complete", description });
        } catch (e) {
          const message = e instanceof Error ? e.message : "Unexpected error.";
          setResults((prev) => ({
            ...prev,
            [key]: { label, count: 0, finishedAt: new Date().toISOString(), ok: false },
          }));
          toast.error("Integration scan failed", { description: message });
          push({ kind: "error", title: "Integration scan failed", description: message });
        } finally {
          inflight.current.delete(key);
          setRunning((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
          });
        }
      })();
    },
    [push],
  );

  const value = useMemo(() => ({ running, results, start }), [running, results, start]);
  return (
    <IntegrationScanContext.Provider value={value}>{children}</IntegrationScanContext.Provider>
  );
}

export function useIntegrationScan(
  kind: IntegrationScanKind,
  organizationId: number,
  integrationId: number,
) {
  const ctx = useContext(IntegrationScanContext);
  if (!ctx) throw new Error("useIntegrationScan must be used inside <IntegrationScanProvider>");
  const key = integrationScanKey(kind, organizationId, integrationId);
  return {
    running: ctx.running[key] ?? null,
    result: ctx.results[key] ?? null,
    start: (label: string) => ctx.start({ kind, organizationId, integrationId, label }),
  };
}
