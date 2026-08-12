import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { ModuleKey } from "./security";
import type { ScanResult } from "@/components/dashboard/ScanLauncher";

type StoredResult = { result: ScanResult; ranAt: string };

type ScanResultsContextValue = {
  get: (module: ModuleKey) => StoredResult | null;
  set: (module: ModuleKey, result: ScanResult) => void;
  reset: (module: ModuleKey) => void;
};

const ScanResultsContext = createContext<ScanResultsContextValue | null>(null);

const STORAGE_KEY = "secureflow.scanResults.v1";

function loadInitial(): Record<string, StoredResult> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, StoredResult>) : {};
  } catch {
    // Corrupt or unavailable sessionStorage shouldn't break the page —
    // just start fresh.
    return {};
  }
}

function persist(data: Record<string, StoredResult>) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage full/unavailable (e.g. private browsing) — the in-memory
    // state still works for this session, it just won't survive a reload.
  }
}

/**
 * Holds each module's last scan result at the dashboard layout level
 * (src/routes/dashboard.tsx), which stays mounted across every module page
 * navigation — only the <Outlet/> child (the individual ModulePage)
 * unmounts/remounts when you switch modules. Previously each ModulePage
 * held this in its own local useState, so navigating away and back (or to
 * any other module) silently discarded the results of the scan you just
 * ran. Backed by sessionStorage too, so a page refresh doesn't lose it
 * either — cleared automatically when the tab closes, and per-module via
 * the Reset button, never mixed between modules.
 */
export function ScanResultsProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Record<string, StoredResult>>(loadInitial);

  const get = useCallback((module: ModuleKey) => data[module] ?? null, [data]);

  const set = useCallback((module: ModuleKey, result: ScanResult) => {
    setData((prev) => {
      const next = { ...prev, [module]: { result, ranAt: new Date().toISOString() } };
      persist(next);
      return next;
    });
  }, []);

  const reset = useCallback((module: ModuleKey) => {
    setData((prev) => {
      if (!(module in prev)) return prev;
      const next = { ...prev };
      delete next[module];
      persist(next);
      return next;
    });
  }, []);

  const value = useMemo(() => ({ get, set, reset }), [get, set, reset]);

  return <ScanResultsContext.Provider value={value}>{children}</ScanResultsContext.Provider>;
}

/** Convenience hook for a single module — mirrors the shape of the old
 * local useState so ModulePage barely has to change. */
export function useScanResult(module: ModuleKey) {
  const ctx = useContext(ScanResultsContext);
  if (!ctx) throw new Error("useScanResult must be used inside <ScanResultsProvider>");

  const stored = ctx.get(module);

  return {
    result: stored?.result ?? null,
    ranAt: stored ? new Date(stored.ranAt) : null,
    setResult: (result: ScanResult) => ctx.set(module, result),
    resetResult: () => ctx.reset(module),
  };
}
