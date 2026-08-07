import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SeverityBadge, PriorityBadge } from "./primitives";
import { priorityTooltip, type Finding } from "@/lib/security";
import { ExternalLink } from "lucide-react";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        {title}
      </div>
      <div className="mt-1.5 text-[13px] leading-relaxed text-foreground">{children}</div>
    </div>
  );
}

export function FindingDetailDialog({
  finding,
  onOpenChange,
}: {
  finding: Finding | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={finding !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        {finding && (
          <>
            <DialogHeader>
              <DialogTitle className="pr-8 font-display text-base leading-snug">
                {finding.title}
              </DialogTitle>
              <DialogDescription asChild>
                <div className="flex flex-wrap items-center gap-2 pt-1 font-mono text-[11px] text-muted-foreground">
                  <SeverityBadge level={finding.severity} />
                  <span className="flex items-center gap-1.5">
                    <span className="uppercase tracking-[0.14em] text-[10px]">Priority</span>
                    <PriorityBadge
                      score={finding.priorityScore}
                      level={finding.priorityRiskLevel}
                      tooltip={
                        finding.priorityScore === null && !finding.priorityRiskLevel
                          ? "No priority data available"
                          : priorityTooltip(finding.priorityBasis)
                      }
                    />
                  </span>
                  <span>{finding.moduleLabel}</span>
                  {finding.location && <span>· {finding.location}</span>}
                  {finding.cwe && <span>· {finding.cwe}</span>}
                  {finding.owasp && <span>· {finding.owasp}</span>}
                </div>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5">
              {finding.description && <Section title="Description">{finding.description}</Section>}

              {finding.recommendation && (
                <Section title="Recommendation">{finding.recommendation}</Section>
              )}

              {finding.iso && (
                <Section title="ISO 27001">
                  <span className="font-mono text-[12px] text-accent">{finding.iso.control}</span>
                  {finding.iso.name && <span> — {finding.iso.name}</span>}
                  {finding.iso.description && (
                    <p className="mt-1 text-[12px] text-muted-foreground">
                      {finding.iso.description}
                    </p>
                  )}
                </Section>
              )}

              {finding.codeContext.length > 0 && (
                <Section title="Code context">
                  <pre className="overflow-x-auto rounded-lg border border-border/60 bg-secondary/20 py-2 font-mono text-[12px] leading-[1.55]">
                    {finding.codeContext.map((l, i) => (
                      <div
                        key={i}
                        className={`flex gap-3 px-3 ${
                          l.highlight ? "bg-critical/10 text-critical" : "text-muted-foreground"
                        }`}
                      >
                        <span className="w-10 shrink-0 select-none text-right opacity-60 tabular-nums">
                          {l.ln ?? ""}
                        </span>
                        <span className="whitespace-pre">{l.code}</span>
                      </div>
                    ))}
                  </pre>
                </Section>
              )}

              {finding.references.length > 0 && (
                <Section title="References">
                  <ul className="space-y-1">
                    {finding.references.map((r) => (
                      <li key={r}>
                        <a
                          href={r}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="inline-flex items-center gap-1 break-all text-[12px] text-accent hover:underline"
                        >
                          {r}
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
