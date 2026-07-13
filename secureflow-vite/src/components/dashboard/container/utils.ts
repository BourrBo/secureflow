import { ContainerDependency } from "./types";

export function filterDependencies(
  data: ContainerDependency[],
  search: string,
  severity: string
) {
  const keyword = search.toLowerCase();

  return data.filter((item) => {
    const matchesSeverity =
      severity === "all" ||
      item.severity === severity;

    const matchesSearch =
      item.name.toLowerCase().includes(keyword) ||
      item.cve.toLowerCase().includes(keyword) ||
      item.ecosystem.toLowerCase().includes(keyword);

    return matchesSeverity && matchesSearch;
  });
}

export function countSeverity(
  data: ContainerDependency[]
) {
  return {
    critical: data.filter(
      (d) => d.severity === "critical"
    ).length,

    high: data.filter(
      (d) => d.severity === "high"
    ).length,

    medium: data.filter(
      (d) => d.severity === "medium"
    ).length,

    low: data.filter(
      (d) => d.severity === "low"
    ).length,
  };
}

export function sortDependencies(
  data: ContainerDependency[],
  sortBy: string
) {
  const items = [...data];

  switch (sortBy) {

    case "package":
      return items.sort((a, b) =>
        a.name.localeCompare(b.name)
      );

    case "cvss":
      return items.sort(
        (a, b) =>
          (b.cvss ?? 0) - (a.cvss ?? 0)
      );

    case "severity":

    default: {

      const order = {
        critical: 4,
        high: 3,
        medium: 2,
        low: 1,
      };

      return items.sort(
        (a, b) =>
          order[b.severity] - order[a.severity]
      );
    }
  }
}