import { createFileRoute } from "@tanstack/react-router";
import { ModulePage } from "@/components/dashboard/ModulePage";
export const Route = createFileRoute("/dashboard/sca")({
  component: () => (
    <ModulePage
      module="sca"
      description="Dependency and supply-chain analysis with CVSS + exploit-likelihood scoring, plus automatic SBOM generation in CycloneDX and SPDX."
    />
  ),
});
