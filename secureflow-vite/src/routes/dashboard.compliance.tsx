import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Panel } from "@/components/dashboard/primitives";
import { ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/dashboard/compliance")({ component: Compliance });

const frameworks = [
  { name: "SOC 2 Type II", pct: 92, controls: "104 / 113", tone: "success" },
  { name: "ISO 27001:2022", pct: 78, controls: "72 / 93", tone: "info" },
  { name: "PCI DSS 4.0", pct: 64, controls: "156 / 244", tone: "warning" },
  { name: "HIPAA", pct: 51, controls: "38 / 74", tone: "warning" },
  { name: "NIST 800-53", pct: 44, controls: "412 / 945", tone: "warning" },
  { name: "GDPR", pct: 88, controls: "22 / 25", tone: "success" },
];

function Compliance() {
  return (
    <>
      <PageHeader eyebrow="Workspace" title="Compliance" description="Continuous, automated evidence collection across the frameworks your customers require." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {frameworks.map((f) => (
          <Panel key={f.name}>
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary"><ShieldCheck className="h-4 w-4" /></div>
              <div>
                <div className="font-semibold">{f.name}</div>
                <div className="text-xs text-muted-foreground">{f.controls} controls</div>
              </div>
              <div className="ml-auto font-display text-2xl font-bold gradient-text">{f.pct}%</div>
            </div>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full bg-[image:var(--gradient-primary)]" style={{ width: `${f.pct}%` }} />
            </div>
          </Panel>
        ))}
      </div>
    </>
  );
}