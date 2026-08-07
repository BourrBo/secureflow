import { createFileRoute } from "@tanstack/react-router";
import { ModulePage } from "@/components/dashboard/ModulePage";
export const Route = createFileRoute("/dashboard/iac")({
  component: () => (
    <ModulePage
      module="iac"
      description="Infrastructure-as-code review for Terraform, Helm, Kubernetes and CloudFormation — misconfigurations caught before anything is provisioned."
    />
  ),
});
