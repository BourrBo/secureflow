import { ContainerPagination } from "@/components/dashboard/container/ContainerPagination";
import { ContainerSort } from "@/components/dashboard/container/ContainerSort";
import { ContainerTable } from "@/components/dashboard/container/ContainerTable";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import {
  PageHeader,
  Panel,
  SeverityBadge,
} from "@/components/dashboard/primitives";

import {
  ISO27001Badge,
  ViewStandardLink,
  ExportReportButton,
} from "@/components/dashboard/ISO27001";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { scanContainerImage } from "@/lib/api/container";

import { ContainerSearch } from "@/components/dashboard/container/ContainerSearch";
import { ContainerStats } from "@/components/dashboard/container/ContainerStats";
import { ContainerEmptyState } from "@/components/dashboard/container/ContainerEmptyState";

import {
  filterDependencies,
  countSeverity,
  sortDependencies,
} from "@/components/dashboard/container/utils";

import type {
  ContainerDependency,
} from "@/components/dashboard/container/types";

export const Route = createFileRoute("/dashboard/container")({
  component: ContainerPage,
});

function mapSeverity(
  raw: string
): ContainerDependency["severity"] {

  const s = raw.toUpperCase();

  if (s === "CRITICAL") return "critical";
  if (s === "HIGH") return "high";
  if (s === "MEDIUM") return "medium";

  return "low";
}

function ContainerPage() {

  const [imageName, setImageName] =
    useState("nginx:latest");

  const [dependencies, setDependencies] =
    useState<ContainerDependency[]>([]);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [hasScanned, setHasScanned] =
    useState(false);

  const [activeTab, setActiveTab] =
    useState("all");

  const [search, setSearch] =
    useState("");
    
    const [sortBy, setSortBy] = useState("severity");
    const PAGE_SIZE = 10;

const [currentPage, setCurrentPage] = useState(1);

  const runScan = async () => {

    if (!imageName.trim()) {

      setError("Please enter a container image.");

      return;

    }

    setLoading(true);

    setError(null);

    setDependencies([]);

    try {

      const findings =
        await scanContainerImage(imageName);

      const normalized: ContainerDependency[] =
        findings.map((item, index) => ({

          id: index + 1,

          name:
            item.title ||
            "Unknown Package",

          severity:
            mapSeverity(item.severity),

          installedVersion:
            item.installed_version ||
            "—",

          fixedVersion:
            item.fixed_version ||
            "No fix available",

          cve:
            item.rule ||
            "—",

          cvss:
            item.cvss ?? null,

          ecosystem:
            item.ecosystem ||
            "Container",

          file:
            item.file,

          description:
            item.description,

          cwe:
            item.cwe,

          iso27001Control:
            item.iso27001_control ||
            "8.8",

          iso27001ControlName:
            item.iso27001_control_name ||
            "Management of technical vulnerabilities",

          iso27001Description:
            item.iso27001_description ||
            "Information about technical vulnerabilities shall be obtained, evaluated and remediated.",

        }));

      setDependencies(normalized);
      setCurrentPage(1);

      setHasScanned(true);

    } catch (err) {

      setError(

        err instanceof Error

          ? err.message

          : "Container scan failed."

      );

    } finally {

      setLoading(false);

    }

  };

  const counts = useMemo(

    () => countSeverity(dependencies),

    [dependencies]

  );

 const filtered = useMemo(() => {

  const filteredData = filterDependencies(
    dependencies,
    search,
    activeTab
  );

  return sortDependencies(
    filteredData,
    sortBy
  );

}, [
  dependencies,
  search,
  activeTab,
  sortBy,
]);

  const totalPages = Math.max(
    1,
    Math.ceil(filtered.length / PAGE_SIZE)
  );

  const reportFindings = filtered.map(

    (d) => ({

      title: d.name,

      severity: d.severity,

      file: d.file,

      line: 0,

      description: d.description,

      rule: d.cve,

      cwe: d.cwe,

      owasp: "A06:2021",

      scanner: "container",

      installed_version:
        d.installedVersion,

      fixed_version:
        d.fixedVersion,

      cvss:
        d.cvss,

      ecosystem:
        d.ecosystem,

      iso27001_control:
        d.iso27001Control,

      iso27001_control_name:
        d.iso27001ControlName,

      iso27001_description:
        d.iso27001Description,

    })

  );

  return (

    <>

      <PageHeader

        eyebrow="Scanner · Container"

        title="Container Vulnerability Scanner"

        description="Scan Docker and OCI images using Trivy."

        actions={

          <div className="flex flex-wrap gap-2">

            <ViewStandardLink />

            <ExportReportButton

              findings={reportFindings}

              scanType="container"

              repoLabel={imageName}

            />

          </div>

        }

      />

          <Panel>

        <div className="space-y-5">

          <div>

            <label className="mb-2 block text-sm font-medium">

              Container Image

            </label>
<Input
  value={imageName}
  onChange={(e) =>
    setImageName(e.target.value)
  }
  placeholder="nginx:latest"
/>

            <p className="mt-2 text-xs text-muted-foreground">

              Examples:

              <span className="ml-2 font-mono">

                nginx:latest

              </span>

              ,

              <span className="ml-2 font-mono">

                ubuntu:22.04

              </span>

              ,

              <span className="ml-2 font-mono">

                python:3.13

              </span>

            </p>

          </div>

          <Button

            onClick={runScan}

            disabled={loading}

          >

            {loading

              ? "Scanning..."

              : "Run Container Scan"}

          </Button>

          {error && (

            <div className="rounded-md border border-red-500 bg-red-500/10 p-3 text-sm text-red-500">

              {error}

            </div>

          )}

        </div>

      </Panel>

      {hasScanned ? (

        <>

          <div className="mt-6">

            <ContainerStats

              critical={counts.critical}

              high={counts.high}

              medium={counts.medium}

              low={counts.low}

            />

          </div>

          <Panel>

            <div className="mb-5 space-y-4">

              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <ContainerSearch
                  value={search}
                  onChange={(value) => {
                    setSearch(value);
                    setCurrentPage(1);
                  }}
                />

                <ContainerSort
                  value={sortBy}
                  onChange={setSortBy}
                />
              </div>

              <div className="flex flex-wrap gap-2">

                {[

                  {

                    key: "all",

                    label: "All",

                    count: dependencies.length,

                  },

                  {

                    key: "critical",

                    label: "Critical",

                    count: counts.critical,

                  },

                  {

                    key: "high",

                    label: "High",

                    count: counts.high,

                  },

                  {

                    key: "medium",

                    label: "Medium",

                    count: counts.medium,

                  },

                  {

                    key: "low",

                    label: "Low",

                    count: counts.low,

                  },

                ].map((tab) => (

                  <Button

                    key={tab.key}

                    variant={

                      activeTab === tab.key

                        ? "secondary"

                        : "ghost"

                    }

                    size="sm"

                   onClick={() => {
    setActiveTab(tab.key);
    setCurrentPage(1);
}}

                  >

                    {tab.label}

                    <span className="ml-1 opacity-60">

                      {tab.count}

                    </span>

                  </Button>

                ))}

              </div>

          </div>

              <ContainerTable
                dependencies={filtered}
                currentPage={currentPage}
                pageSize={PAGE_SIZE}
              />

              <ContainerPagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filtered.length}
                pageSize={PAGE_SIZE}
                onPrevious={() =>
                  setCurrentPage((p) => Math.max(1, p - 1))
                }
                onNext={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
              />

            </Panel>
          </>
      ) : (
        <div className="mt-6">
          <ContainerEmptyState />
        </div>
      )}
    </>
  );
}