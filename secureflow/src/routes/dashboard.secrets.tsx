import { createFileRoute } from "@tanstack/react-router";
import { ModulePage } from "@/components/dashboard/ModulePage";
export const Route = createFileRoute("/dashboard/secrets")({
  component: () => (
    <ModulePage
      module="secrets"
      description="Detection of leaked cloud keys, access tokens and credentials across your working tree and full commit history."
    />
  ),
});
