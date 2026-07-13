export type ContainerDependency = {
  id: number;
  name: string;
  severity: "critical" | "high" | "medium" | "low";
  installedVersion: string;
  fixedVersion: string;
  cve: string;
  cvss: number | null;
  ecosystem: string;
  file: string;
  description: string;
  cwe: string;
  iso27001Control: string;
  iso27001ControlName: string;
  iso27001Description: string;
};

export type PaginationProps = {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPrevious: () => void;
  onNext: () => void;
};