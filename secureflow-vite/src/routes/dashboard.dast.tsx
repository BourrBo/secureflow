import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/dashboard/primitives";
export const Route = createFileRoute("/dashboard/dast")({ component: () => <ModulePlaceholder name="DAST" description="Runtime dynamic analysis of your deployed applications. Coming soon." /> });
