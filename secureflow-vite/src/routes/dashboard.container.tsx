import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/dashboard/primitives";
export const Route = createFileRoute("/dashboard/container")({ component: () => <ModulePlaceholder name="Container" description="Trivy-powered image scanning for Docker and Kubernetes — OS CVEs, misconfigs, embedded secrets." /> });
