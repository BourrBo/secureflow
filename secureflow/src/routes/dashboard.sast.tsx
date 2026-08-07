import { createFileRoute } from "@tanstack/react-router";
import { ModulePage } from "@/components/dashboard/ModulePage";
export const Route = createFileRoute("/dashboard/sast")({
  component: () => (
    <ModulePage
      module="sast"
      description="Static analysis of your source code across 20+ languages — injection, XSS, broken authentication and unsafe data flows, caught before merge."
    />
  ),
});
