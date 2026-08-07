import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  PageHeader,
  Panel,
  CardsSkeleton,
  EmptyState,
  ErrorState,
} from "@/components/dashboard/primitives";
import { complianceQuery } from "@/lib/queries";
import { ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/dashboard/compliance")({ component: Compliance });

function Compliance() {
  const { data, isLoading, error } = useQuery(complianceQuery());

  return (
    <>
      <PageHeader
        eyebrow="Workspace"
        title="Compliance"
        description="Continuous, automated evidence collection across the frameworks your customers require."
      />
      {error ? (
        <ErrorState error={error} />
      ) : isLoading ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <CardsSkeleton count={6} height={116} />
        </div>
      ) : (data?.length ?? 0) === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="No frameworks enabled"
          description="Enable a framework to map your findings to controls and collect evidence automatically."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data!.map((f) => (
            <Panel key={f.name}>
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-semibold">{f.name}</div>
                  {f.controls && (
                    <div className="text-[11px] text-muted-foreground">{f.controls} controls</div>
                  )}
                </div>
                <div className="ml-auto font-display text-xl font-semibold tabular-nums gradient-text">
                  {f.pct}%
                </div>
              </div>
              <div className="mt-4 h-1 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-[image:var(--gradient-primary)]"
                  style={{ width: `${f.pct}%` }}
                />
              </div>
            </Panel>
          ))}
        </div>
      )}
    </>
  );
}
