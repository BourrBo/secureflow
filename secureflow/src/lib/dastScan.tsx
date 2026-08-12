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
import { api, type ApiFinding } from "./api";
import { useScanResult } from "./scanResults";

type DastStatus = "idle" | "running" | "completed" | "failed";

type DastState = {
  scanId: number | null;
  status: DastStatus;
  targetUrl: string | null;
  phase: string | null;
  pct: number | null;
  error: string | null;
};

type DastScanContextValue = {
  state: DastState;
  start: (targetUrl: string) => Promise<void>;
  reset: () => void;
};

const DastScanContext = createContext<DastScanContextValue | null>(null);

const STORAGE_KEY = "secureflow.dastScan.v1";
const POLL_INTERVAL_MS = 4000;

const IDLE_STATE: DastState = {
  scanId: null,
  status: "idle",
  targetUrl: null,
  phase: null,
  pct: null,
  error: null,
};

function loadInitial(): DastState {
  if (typeof window === "undefined") return IDLE_STATE;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return IDLE_STATE;
    const parsed = JSON.parse(raw) as DastState;
    // Only "running" is worth reattaching to — a completed/failed scan's
    // findings already live in scanResults, and idle has nothing to resume.
    return parsed.status === "running" ? parsed : IDLE_STATE;
  } catch {
    return IDLE_STATE;
  }
}

function persist(state: DastState) {
  if (typeof window === "undefined") return;
  try {
    if (state.status === "running") {
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

        if (res.status === "completed") {
          const findings: ApiFinding[] = res.findings ?? [];
          setResult({ findings, label: stateRef.current.targetUrl ?? `scan #${scanId}` });
          setState((s) => ({ ...s, status: "completed", phase: "complete", pct: 100 }));
          toast.success("DAST scan complete", {
            description: `${findings.length} finding${findings.length === 1 ? "" : "s"} returned.`,
          });
          clearTimer();
          return;
        }

        if (res.status === "failed") {
          const message = res.error || "DAST scan failed.";
          setState((s) => ({ ...s, status: "failed", error: message }));
          toast.error("DAST scan failed", { description: message });
          clearTimer();
          return;
        }

        // Still running — real phase/percent from the backend, not a
        // frontend animation.
        setState((s) => ({
          ...s,
          status: "running",
          phase: res.progress_phase ?? s.phase,
          pct: typeof res.progress_pct === "number" ? res.progress_pct : s.pct,
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
    [clearTimer, setResult],
  );

  // Resume polling on mount if a scan was left running (tab switch, nav,
  // or a full page reload) — and reconnect immediately when the browser
  // regains connectivity, rather than waiting out the current interval.
  useEffect(() => {
    if (state.status === "running" && state.scanId !== null) {
      pollOnce(state.scanId);
    }

    const handleOnline = () => {
      if (stateRef.current.status === "running" && stateRef.current.scanId !== null) {
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
    async (targetUrl: string) => {
      clearTimer();
      setState({
        scanId: null,
        status: "running",
        targetUrl,
        phase: "starting",
        pct: null,
        error: null,
      });
      try {
        const started = await api.scanDast(targetUrl, "full");
        setState((s) => ({ ...s, scanId: started.scan_id }));
        pollOnce(started.scan_id);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Could not start scan.";
        setState((s) => ({ ...s, status: "failed", error: message }));
        toast.error("DAST scan failed to start", { description: message });
      }
    },
    [clearTimer, pollOnce],
  );

  const reset = useCallback(() => {
    clearTimer();
    setState(IDLE_STATE);
  }, [clearTimer]);

  const value = useMemo(() => ({ state, start, reset }), [state, start, reset]);

  return <DastScanContext.Provider value={value}>{children}</DastScanContext.Provider>;
}

export function useDastScan(): DastScanContextValue {
  const ctx = useContext(DastScanContext);
  if (!ctx) throw new Error("useDastScan must be used inside <DastScanProvider>");
  return ctx;
}
