import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SeverityBadge, PriorityBadge } from "./primitives";
import {
  priorityTooltip,
  redactedMatch,
  secretTypeLabel,
  iacCategory,
  type Finding,
} from "@/lib/security";
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

/**
 * Secondary metadata lives here rather than in extra table columns. Only the
 * fields that are meaningful for the finding's scanner — and actually
 * populated — are listed; nothing is invented.
 */
function metaFields(f: Finding): Array<{ label: string; value: string }> {
  const out: Array<{ label: string; value: string }> = [];
  const add = (label: string, value?: string | number | null) => {
    if (value !== null && value !== undefined && String(value) !== "") {
      out.push({ label, value: String(value) });
    }
  };

  add("Scanner", f.moduleLabel);
  add("Project", f.project !== "—" ? f.project : "");
  add("Scan", f.scanId ? `#${f.scanId}` : "");

  if (f.module === "sca" || f.module === "container") {
    add("Ecosystem", f.ecosystem);
    add("Installed version", f.installedVersion);
    add("Fixed version", f.fixedVersion);
    add("CVE", f.cve);
    add("CVSS", f.cvss);
    add("EPSS", f.epssScore);
    add("EPSS percentile", f.epssPercentile);
  } else if (f.module === "secrets") {
    add("Secret type", secretTypeLabel(f.rule));
    add("Detection", f.rule === "entropy-generic" ? "Entropy" : "Pattern match");
    add("Redacted match", redactedMatch(f.description));
    add("File · line", f.location);
  } else if (f.module === "iac") {
    add("Check ID / rule", f.rule);
    add("Category", f.file ? iacCategory(f.file) : "");
    add("File · line", f.location);
  } else if (f.module === "dast") {
    add("Target", f.file);
    add("Rule", f.rule);
  } else {
    add("Rule", f.rule);
    add("File · line", f.location);
  }

  add("CWE", f.cwe);
  add("OWASP", f.owasp);
  add("Status", f.status);
  return out;
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
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border border-border/60 bg-secondary/20 p-3 sm:grid-cols-3">
                {metaFields(finding).map((m) => (
                  <div key={m.label}>
                    <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      {m.label}
                    </div>
                    <div className="mt-0.5 break-all font-mono text-[12px] text-foreground">
                      {m.value}
                    </div>
                  </div>
                ))}
              </div>

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
