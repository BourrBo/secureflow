import { queryOptions } from "@tanstack/react-query";
import { api, type FindingsQuery } from "./api";
import { normalizeFinding, normalizeFramework, normalizeProject, normalizeScan } from "./security";

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

/** Capped listing for the workspace Findings page — the table can hold 15k+ rows. */
export const findingsPageQuery = (limit = 10) =>
  queryOptions({
    queryKey: ["findings-page", limit],
    queryFn: async () => {
      const r = await api.listFindings({ limit });
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

export const complianceQuery = () =>
  queryOptions({
    queryKey: ["compliance"],
    queryFn: async () => {
      const r = await api.getCompliance();
      const list = Array.isArray(r) ? r : (r?.frameworks ?? []);
      return list.map(normalizeFramework);
    },
    ...common,
  });
