import { queryOptions } from "@tanstack/react-query";
import { api, type ApiComplianceFramework, type FindingsQuery } from "./api";
import { normalizeFinding, normalizeFramework, normalizeProject, normalizeScan } from "./security";

export type RawControl = {
  control_id?: string;
  control_name?: string | null;
  control_description?: string | null;
  total_findings?: number;
  by_severity?: Record<string, number>;
  framework?: string | null;
};

export type ComplianceResult = {
  frameworks: ReturnType<typeof normalizeFramework>[];
  controls: RawControl[];
};

const common = {
  staleTime: 60_000,
  retry: 1,
} as const;

export const findingsQuery = (q: FindingsQuery = {}) =>
  queryOptions({
    queryKey: ["findings", q],
    queryFn: async () => {
      const r = await api.listFindings(q);
      const list = Array.isArray(r) ? r : (r?.findings ?? []);
      return list.map(normalizeFinding);
    },
    ...common,
  });

export const projectsQuery = () =>
  queryOptions({
    queryKey: ["projects"],
    queryFn: async () => {
      const r = await api.listProjects();
      const list = Array.isArray(r) ? r : (r?.projects ?? []);
      return list.map(normalizeProject);
    },
    ...common,
  });

/**
 * Findings are always requested with their scope explicit: a project page
 * asks for `project_id`, a scan drill-down adds `scan_id`. The IDs travel in
 * the URL/query key, never inferred from a display name.
 */
export const findingsPageQuery = (
  limit: number,
  offset: number,
  filters: Pick<
    FindingsQuery,
    "q" | "project_id" | "scan_id" | "scanner" | "status" | "include_duplicates"
  > = {},

) =>
  queryOptions({
    queryKey: ["findings-page", limit, offset, filters],
    queryFn: async () => {
      const r = await api.listFindings({ limit, offset, ...filters });
      const list = Array.isArray(r) ? r : (r?.findings ?? []);
      const total = !Array.isArray(r) && typeof r?.total === "number" ? r.total : list.length;
      return { items: list.map(normalizeFinding), total };
    },
    ...common,
  });

export const projectScansQuery = (id: string | number) =>
  queryOptions({
    queryKey: ["project-scans", String(id)],
    queryFn: async () => {
      const r = await api.getProjectScans(id);
      const list = Array.isArray(r) ? r : (r?.scans ?? []);
      return list.map(normalizeScan);
    },
    ...common,
  });

export const gateRunsQuery = (projectId?: string | number) =>
  queryOptions({
    queryKey: ["gate-runs", projectId ? String(projectId) : "all"],
    queryFn: async () => {
      const r = await api.listGateRuns(projectId);
      return Array.isArray(r) ? r : (r?.runs ?? []);
    },
    ...common,
  });

export const apiKeysQuery = () =>
  queryOptions({
    queryKey: ["api-keys"],
    queryFn: async () => {
      const r = await api.listApiKeys();
      return Array.isArray(r) ? r : (r?.keys ?? []);
    },
    ...common,
  });

/**
 * The compliance endpoint may return either a list of frameworks or a flat
 * list of controls. Controls are grouped into frameworks here (percentage =
 * passed / total of that framework's real controls) — no values invented.
 */
export const complianceQuery = () =>
  queryOptions({
    queryKey: ["compliance"],
    queryFn: async () => {
      const r = (await api.getCompliance()) as unknown;
      const record = (r && typeof r === "object" && !Array.isArray(r) ? r : {}) as Record<
        string,
        unknown
      >;

      const controls = Array.isArray(record.controls)
        ? (record.controls as Array<Record<string, unknown>>)
        : [];

      const frameworks = Array.isArray(r)
        ? (r as ApiComplianceFramework[])
        : Array.isArray(record.frameworks)
          ? (record.frameworks as ApiComplianceFramework[])
          : null;

      if (frameworks) {
        return {
          frameworks: frameworks.map(normalizeFramework),
          controls: controls as RawControl[],
        };
      }

      if (controls.length === 0) {
        return { frameworks: [], controls: [] };
      }

      const groups = new Map<string, { passed: number; total: number }>();
      for (const c of controls) {
        const name = String(c.framework ?? c.standard ?? c.name ?? "Controls");
        const g = groups.get(name) ?? { passed: 0, total: 0 };
        g.total += 1;
        const status = String(c.status ?? c.result ?? "").toLowerCase();
        if (c.passed === true || status === "pass" || status === "passed" || status === "compliant")
          g.passed += 1;
        groups.set(name, g);
      }
      return {
        frameworks: [...groups.entries()].map(([name, g]) =>
          normalizeFramework({
            name,
            percentage: g.total > 0 ? (g.passed / g.total) * 100 : 0,
            controls_passed: g.passed,
            controls_total: g.total,
          }),
        ),
        controls: controls as RawControl[],
      };
    },
    ...common,
  });
