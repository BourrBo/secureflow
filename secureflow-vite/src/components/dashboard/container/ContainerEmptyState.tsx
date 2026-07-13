import { Container } from "lucide-react";

import { Panel } from "@/components/dashboard/primitives";

export function ContainerEmptyState() {
  return (
    <Panel>
      <div className="grid place-items-center py-16 text-center text-sm text-muted-foreground">

        <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
          <Container className="h-6 w-6" />
        </div>

        <div className="font-medium text-foreground">
          Ready to scan
        </div>

        <div className="mt-1 max-w-sm">
          Enter a Docker or OCI container image above and run a scan to discover vulnerabilities using Trivy.
        </div>

      </div>
    </Panel>
  );
}