import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { api, type ApiFinding, type DastMode, type DastAttackStrength } from "./api";
import { useScanResult } from "./scanResults";
import { useNotifications } from "./notifications";

type DastStatus =
  | "idle"
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "timed_out";

type DastState = {
  scanId: number | null;
  status: DastStatus;
  targetUrl: string | null;
  scanMode: DastMode | null;
  attackStrength: DastAttackStrength | null;
  phase: string | null;
  pct: number | null;
  error: string | null;
  /** Epoch ms when the scan was started client-side, for elapsed time. */
  startedAt: number | null;
  scannerBusy: boolean;
  ajaxSpiderStatus: "completed" | "timed_out" | "failed_to_start" | null;
  scannerCoverage: string | null;
  cancelRequested: boolean;
  partialResults: boolean;
  /** Live ZAP active-scan telemetry; null when the backend hasn't reported it. */
  activeScan: {
    state: string | null;
    requests: number | null;
    progress: number | null;
    alerts: number | null;
  } | null;
};

type DastScanContextValue = {
  state: DastState;
  start: (
    targetUrl: string,
    scanMode?: DastMode,
    attackStrength?: DastAttackStrength,
  ) => Promise<void>;
  cancel: () => Promise<void>;
  reset: () => void;
};

const DastScanContext = createContext<DastScanContextValue | null>(null);

const STORAGE_KEY = "secureflow.dastScan.v1";
const POLL_INTERVAL_MS = 4000;

const IDLE_STATE: DastState = {
  scanId: null,
  status: "idle",
  targetUrl: null,
  scanMode: null,
  attackStrength: null,
  phase: null,
  pct: null,
  error: null,
  startedAt: null,
  scannerBusy: false,
  ajaxSpiderStatus: null,
  scannerCoverage: null,
  cancelRequested: false,
  partialResults: false,
  activeScan: null,
};

function loadInitial(): DastState {
  if (typeof window === "undefined") return IDLE_STATE;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return IDLE_STATE;
    const parsed = JSON.parse(raw) as DastState;
    // Only in-flight scans are worth reattaching to — a terminal scan's
    // findings already live in scanResults, and idle has nothing to resume.
    return parsed.status === "running" || parsed.status === "queued"
      ? {
          ...parsed,
          scanMode: parsed.scanMode ?? null,
          attackStrength: parsed.attackStrength ?? null,
        }
      : IDLE_STATE;
  } catch {
    return IDLE_STATE;
  }
}

function persist(state: DastState) {
  if (typeof window === "undefined") return;
  try {
    if (state.status === "running" || state.status === "queued") {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } else {
      window.sessionStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Storage unavailable (private browsing, full) — polling still works
    // for this session, it just won't survive a reload.
  }
}

/**
 * DAST scans used to live entirely inside ScanLauncher's local component
 * state — a useMutation that polled while mounted. The instant you
 * navigated to another module page, ScanLauncher unmounted, the mutation
 * (and its setInterval-driven polling) was torn down with it, and there
 * was no way to tell whether the scan was still running on the backend or
 * not. It always still was — DAST runs on a background thread server-side,
 * completely independent of any browser tab — the frontend just lost track
 * of it.
 *
 * This context lives at the dashboard layout level instead (see
 * src/routes/dashboard.tsx), so it — and its polling loop — stay mounted
 * for as long as the user is anywhere under /dashboard, regardless of
 * which module page they're looking at. It's also backed by
 * sessionStorage, so switching tabs, navigating away and back, or even
 * refreshing the page mid-scan all reattach to the same running scan_id
 * instead of losing it.
 *
 * Network resilience: a single failed poll is never treated as the scan
 * having failed — the backend keeps running regardless of what the
 * browser's connection is doing. Failed polls just retry on the next
 * interval tick indefinitely (there is no giving-up threshold), and an
 * "online" browser event triggers an immediate retry too, so reconnecting
 * doesn't wait for the next 4s tick.
 */
export function DastScanProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DastState>(loadInitial);
  const { setResult } = useScanResult("dast");
  const { push } = useNotifications();
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const clearTimer = useCallback(() => {
    if (pollTimer.current) {
      clearTimeout(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  const pollOnce = useCallback(
    async (scanId: number) => {
      try {
        const res = await api.getDastScanStatus(scanId);

        // Meta fields that can arrive in any status.
        const meta = {
          ajaxSpiderStatus: res.ajax_spider_status ?? null,
          scannerCoverage: res.scanner_coverage ?? null,
          cancelRequested: res.cancel_requested === true,
        };

        if (res.status === "completed" || res.status === "timed_out") {
          const timedOut = res.status === "timed_out";
          const findings: ApiFinding[] = res.findings ?? [];
          setResult({ findings, label: stateRef.current.targetUrl ?? `scan #${scanId}` });
          setState((s) => ({
            ...s,
            ...meta,
            status: timedOut ? "timed_out" : "completed",
            phase: "complete",
            pct: 100,
            partialResults: timedOut || res.partial_results === true,
            error: timedOut ? (res.error ?? "Scan hit its safety timeout.") : null,
          }));
          const desc = `${findings.length} finding${findings.length === 1 ? "" : "s"} returned.`;
          if (timedOut) {
            toast.warning("DAST scan timed out — partial results", { description: desc });
          } else {
            toast.success("DAST scan complete", { description: desc });
          }
          push({
            kind: timedOut ? "info" : "success",
            title: timedOut ? "DAST scan timed out (partial results)" : "DAST scan complete",
            description: `${stateRef.current.targetUrl ?? `scan #${scanId}`} — ${findings.length} finding${findings.length === 1 ? "" : "s"}`,
          });
          clearTimer();
          return;
        }

        if (res.status === "cancelled") {
          const message = res.error || "Scan cancelled.";
          setState((s) => ({ ...s, ...meta, status: "cancelled", error: message }));
          toast.info("DAST scan cancelled", { description: message });
          push({ kind: "info", title: "DAST scan cancelled", description: message });
          clearTimer();
          return;
        }

        if (res.status === "failed") {
          const message = res.error || "DAST scan failed.";
          setState((s) => ({ ...s, ...meta, status: "failed", error: message }));
          toast.error("DAST scan failed", { description: message });
          push({ kind: "error", title: "DAST scan failed", description: message });
          clearTimer();
          return;
        }

        // Still queued or running — real phase/percent from the backend,
        // not a frontend animation.
        setState((s) => ({
          ...s,
          ...meta,
          status: res.status === "queued" ? "queued" : "running",
          phase: res.progress_phase ?? s.phase,
          pct: typeof res.progress_pct === "number" ? res.progress_pct : s.pct,
          activeScan:
            res.active_scan_state != null ||
            typeof res.active_scan_requests === "number" ||
            typeof res.active_scan_progress === "number" ||
            typeof res.active_scan_alerts === "number"
              ? {
                  state: res.active_scan_state ?? null,
                  requests:
                    typeof res.active_scan_requests === "number" ? res.active_scan_requests : null,
                  progress:
                    typeof res.active_scan_progress === "number" ? res.active_scan_progress : null,
                  alerts:
                    typeof res.active_scan_alerts === "number" ? res.active_scan_alerts : null,
                }
              : s.activeScan,
        }));
        pollTimer.current = setTimeout(() => pollOnce(scanId), POLL_INTERVAL_MS);
      } catch {
        // Network hiccup (or tunnel drop) — the scan is still running on
        // the backend, so this is never treated as a failure. Just try
        // again on the next tick; the "online" listener below also fires
        // an immediate retry once connectivity actually returns.
        pollTimer.current = setTimeout(() => pollOnce(scanId), POLL_INTERVAL_MS);
      }
    },
    [clearTimer, setResult, push],
  );

  // Resume polling on mount if a scan was left running (tab switch, nav,
  // or a full page reload) — and reconnect immediately when the browser
  // regains connectivity, rather than waiting out the current interval.
  useEffect(() => {
    if ((state.status === "running" || state.status === "queued") && state.scanId !== null) {
      pollOnce(state.scanId);
    }

    const handleOnline = () => {
      const st = stateRef.current.status;
      if ((st === "running" || st === "queued") && stateRef.current.scanId !== null) {
        clearTimer();
        pollOnce(stateRef.current.scanId);
      }
    };
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("online", handleOnline);
      clearTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    persist(state);
  }, [state]);

  const start = useCallback(
    async (
      targetUrl: string,
      scanMode: DastMode = "full",
      attackStrength: DastAttackStrength = "MEDIUM",
    ) => {
      clearTimer();
      setState({
        ...IDLE_STATE,
        status: "running",
        targetUrl,
        scanMode,
        attackStrength,
        phase: "starting",
        startedAt: Date.now(),
      });
      try {
        const started = await api.scanDast(targetUrl, scanMode, attackStrength);
        const queued = started.status === "queued" || started.scanner_busy === true;
        setState((s) => ({
          ...s,
          scanId: started.scan_id,
          status: queued ? "queued" : "running",
          scannerBusy: started.scanner_busy === true,
          phase: queued ? "queued" : s.phase,
        }));
        push({ kind: "info", title: "DAST scan started", description: targetUrl });
        pollOnce(started.scan_id);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Could not start scan.";
        setState((s) => ({ ...s, status: "failed", error: message }));
        toast.error("DAST scan failed to start", { description: message });
        push({ kind: "error", title: "DAST scan failed to start", description: message });
      }
    },
    [clearTimer, pollOnce, push],
  );

  const reset = useCallback(() => {
    clearTimer();
    setState(IDLE_STATE);
  }, [clearTimer]);

  const cancel = useCallback(async () => {
    const scanId = stateRef.current.scanId;
    if (scanId === null) return;
    setState((s) => ({ ...s, cancelRequested: true }));
    try {
      await api.cancelDastScan(scanId);
      toast.info("Cancellation requested", {
        description: "Waiting for the scanner to stop — this is not instant.",
      });
      // Cancellation is cooperative: keep polling until status flips.
      clearTimer();
      pollOnce(scanId);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not cancel scan.";
      setState((s) => ({ ...s, cancelRequested: false }));
      toast.error("Could not cancel scan", { description: message });
    }
  }, [clearTimer, pollOnce]);

  const value = useMemo(() => ({ state, start, cancel, reset }), [state, start, cancel, reset]);

  return <DastScanContext.Provider value={value}>{children}</DastScanContext.Provider>;
}

export function useDastScan(): DastScanContextValue {
  const ctx = useContext(DastScanContext);
  if (!ctx) throw new Error("useDastScan must be used inside <DastScanProvider>");
  return ctx;
}
