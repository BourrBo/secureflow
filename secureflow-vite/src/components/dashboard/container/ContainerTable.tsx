import {
  ISO27001Badge,
} from "@/components/dashboard/ISO27001";

import {
  SeverityBadge,
} from "@/components/dashboard/primitives";

import type {
  ContainerDependency,
} from "./types";

type Props = {
  dependencies: ContainerDependency[];
  currentPage: number;
  pageSize: number;
};

export function ContainerTable({
  dependencies,
  currentPage,
  pageSize,
}: Props) {

  const start = (currentPage - 1) * pageSize;

  const end = start + pageSize;

  const paginated = dependencies.slice(
    start,
    end
  );

  return (
    <div className="-mx-6 overflow-x-auto">

      <table className="w-full min-w-[920px] text-sm">

        <thead>

          <tr className="border-b border-border text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground">

            <th className="px-6 py-3">
              Package
            </th>

            <th className="px-3 py-3">
              Ecosystem
            </th>

            <th className="px-3 py-3">
              Installed
            </th>

            <th className="px-3 py-3">
              Fixed
            </th>

            <th className="px-3 py-3">
              CVE
            </th>

            <th className="px-3 py-3">
              CVSS
            </th>

            <th className="px-3 py-3">
              Severity
            </th>

            <th className="px-6 py-3">
              ISO 27001
            </th>

          </tr>

        </thead>

        <tbody>

          {paginated.length === 0 ? (

            <tr>

              <td
                colSpan={8}
                className="px-6 py-12 text-center text-muted-foreground"
              >
                No vulnerabilities found.
              </td>

            </tr>

          ) : (

            paginated.map((d) => (

              <tr
                key={d.id}
                className="border-b border-border/40 transition-colors hover:bg-secondary/40"
              >

                <td className="px-6 py-3 font-medium">
                  {d.name}
                </td>

                <td className="px-3 py-3 font-mono text-xs text-muted-foreground">
                  {d.ecosystem}
                </td>

                <td className="px-3 py-3 font-mono text-xs">
                  {d.installedVersion}
                </td>

                <td className="px-3 py-3 font-mono text-xs text-green-600 dark:text-green-400">
                  {d.fixedVersion}
                </td>

                <td className="px-3 py-3 font-mono text-xs">
                  {d.cve}
                </td>

                <td className="px-3 py-3 font-mono text-xs">
                  {d.cvss ?? "—"}
                </td>

                <td className="px-3 py-3">

                  <SeverityBadge
                    level={d.severity}
                  />

                </td>

                <td className="px-6 py-3">

                  <ISO27001Badge
                    info={{
                      control:
                        d.iso27001Control,
                      controlName:
                        d.iso27001ControlName,
                      description:
                        d.iso27001Description,
                    }}
                  />

                </td>

              </tr>

            ))

          )}

        </tbody>

      </table>

    </div>
  );
}