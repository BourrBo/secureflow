import { createFileRoute } from "@tanstack/react-router";
import { ModulePage } from "@/components/dashboard/ModulePage";
export const Route = createFileRoute("/dashboard/container")({
  component: () => (
    <ModulePage
      module="container"
      description="Image analysis for Docker and Kubernetes workloads — operating-system CVEs, insecure configuration and credentials baked into layers."
    />
  ),
});
