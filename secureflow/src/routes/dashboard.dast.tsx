import { createFileRoute } from "@tanstack/react-router";
import { ModulePage } from "@/components/dashboard/ModulePage";
export const Route = createFileRoute("/dashboard/dast")({
  component: () => (
    <ModulePage
      module="dast"
      description="Runtime testing against your deployed environments — authentication, access control and injection issues observed in live traffic."
    />
  ),
});
