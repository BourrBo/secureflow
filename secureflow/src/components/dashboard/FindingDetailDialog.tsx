import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SeverityBadge, PriorityBadge, StatusBadge } from "./primitives";
import {
  priorityTooltip,
  redactedMatch,
  secretTypeLabel,
  iacCategory,
  normalizeFinding,
  normalizeStatus,
  scannerLabel,
  FINDING_STATUSES,
  type Finding,
  type FindingStatusKey,
} from "@/lib/security";
import { api } from "@/lib/api";
import { ExternalLink, Copy, Loader2 } from "lucide-react";

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
  const queryClient = useQueryClient();
  const [override, setOverride] = useState<Finding | null>(null);
  const [loadingCanonical, setLoadingCanonical] = useState(false);

  // A newly opened row always starts from its own data — never the previously
  // inspected finding's canonical swap.
  useEffect(() => {
    setOverride(null);
  }, [finding?.id]);

  const active = override ?? finding;
  const isDuplicate = Boolean(active?.duplicateOf);

  const duplicates = useQuery({
    queryKey: ["finding-duplicates", active?.id],
    // Lazy: only while this dialog is actually open for a canonical finding
    // that the backend says has other detections.
    enabled: Boolean(active && !isDuplicate && active.duplicateCount > 0),
    queryFn: async () => {
      const r = await api.listFindingDuplicates(active!.id);
      return (r?.duplicates ?? []).map(normalizeFinding);
    },
    staleTime: 60_000,
  });

  async function openCanonical(id: string) {
    setLoadingCanonical(true);
    try {
      const raw = await api.getFinding(id);
      setOverride(normalizeFinding(raw, 0));
    } catch (e) {
      toast.error("Could not open the canonical finding", {
        description: e instanceof Error ? e.message : "Unexpected error.",
      });
    } finally {
      setLoadingCanonical(false);
    }
  }

  return (
    <Dialog open={finding !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        {active && (
          <>
            <DialogHeader>
              <DialogTitle className="pr-8 font-display text-base leading-snug">
                {active.title}
              </DialogTitle>
              <DialogDescription asChild>
                <div className="flex flex-wrap items-center gap-2 pt-1 font-mono text-[11px] text-muted-foreground">
                  <SeverityBadge level={active.severity} />
                  <span className="flex items-center gap-1.5">
                    <span className="uppercase tracking-[0.14em] text-[10px]">Priority</span>
                    <PriorityBadge
                      score={active.priorityScore}
                      level={active.priorityRiskLevel}
                      tooltip={
                        active.priorityScore === null && !active.priorityRiskLevel
                          ? "No priority data available"
                          : priorityTooltip(active.priorityBasis)
                      }
                    />
                  </span>
                  <span>{active.moduleLabel}</span>
                  {active.location && <span>· {active.location}</span>}
                  {active.cwe && <span>· {active.cwe}</span>}
                  {active.owasp && <span>· {active.owasp}</span>}
                </div>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border border-border/60 bg-secondary/20 p-3 sm:grid-cols-3">
                {metaFields(active).map((m) => (
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

              {isDuplicate ? (
                <div className="rounded-lg border border-border/60 bg-secondary/20 p-3">
                  <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    Duplicate detection
                  </div>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-foreground">
                    This is a duplicate detection — status, owner, and notes are managed on finding
                    #{active.duplicateOf}.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2.5 h-7 text-[11px]"
                    disabled={loadingCanonical}
                    onClick={() => openCanonical(active.duplicateOf!)}
                  >
                    {loadingCanonical && <Loader2 className="h-3 w-3 animate-spin" />}
                    Open finding #{active.duplicateOf}
                  </Button>
                </div>
              ) : (
                <TriagePanel
                  key={active.id}
                  finding={active}
                  onSaved={(updated) => {
                    setOverride(updated);
                    queryClient.invalidateQueries({ queryKey: ["findings-page"] });
                    queryClient.invalidateQueries({ queryKey: ["findings"] });
                  }}
                />
              )}

              {!isDuplicate && active.duplicateCount > 0 && (
                <Section title="Also detected">
                  {duplicates.isLoading ? (
                    <span className="font-mono text-[11px] text-muted-foreground">Loading…</span>
                  ) : duplicates.error ? (
                    <span className="font-mono text-[11px] text-muted-foreground">
                      Could not load other detections.
                    </span>
                  ) : (
                    <ul className="space-y-1.5">
                      {(duplicates.data ?? []).map((d) => (
                        <li
                          key={d.id}
                          className="flex items-center gap-2 rounded-md border border-border/60 bg-secondary/20 px-2.5 py-1.5 font-mono text-[11px] text-muted-foreground"
                        >
                          <Copy className="h-3 w-3 shrink-0" />
                          <span className="text-foreground">
                            {scannerLabel(String(d.raw.scan_type ?? "")) !== "Scanner"
                              ? `${scannerLabel(String(d.raw.scan_type ?? ""))} scan`
                              : `${d.moduleLabel} scan`}
                          </span>
                          <span>
                            —{" "}
                            {(() => {
                              const raw = d.raw.scan_started_at ?? d.raw.created_at;
                              const dt = raw ? new Date(String(raw)) : null;
                              return dt && !Number.isNaN(dt.getTime())
                                ? dt.toLocaleDateString(undefined, {
                                    month: "short",
                                    day: "numeric",
                                  })
                                : "unknown date";
                            })()}
                          </span>
                          <span className="ml-auto">#{d.id}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Section>
              )}



              {active.description && <Section title="Description">{active.description}</Section>}

              {active.recommendation && (
                <Section title="Recommendation">{active.recommendation}</Section>
              )}

              {active.iso && (
                <Section title="ISO 27001">
                  <span className="font-mono text-[12px] text-accent">{active.iso.control}</span>
                  {active.iso.name && <span> — {active.iso.name}</span>}
                  {active.iso.description && (
                    <p className="mt-1 text-[12px] text-muted-foreground">
                      {active.iso.description}
                    </p>
                  )}
                </Section>
              )}

              {active.codeContext.length > 0 && (
                <Section title="Code context">
                  <pre className="overflow-x-auto rounded-lg border border-border/60 bg-secondary/20 py-2 font-mono text-[12px] leading-[1.55]">
                    {active.codeContext.map((l, i) => (
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

              {active.references.length > 0 && (
                <Section title="References">
                  <ul className="space-y-1">
                    {active.references.map((r) => (
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

/**
 * Lifecycle triage. Only rendered for canonical findings — the backend
 * rejects a PATCH against a duplicate row, and the duplicate notice above
 * routes the reviewer to the canonical finding instead.
 */
function TriagePanel({
  finding,
  onSaved,
}: {
  finding: Finding;
  onSaved: (updated: Finding) => void;
}) {
  const [status, setStatus] = useState<FindingStatusKey>(normalizeStatus(finding.status));
  const [owner, setOwner] = useState(finding.owner);
  const [notes, setNotes] = useState(finding.notes);
  const [saving, setSaving] = useState(false);

  const dirty =
    status !== normalizeStatus(finding.status) ||
    owner !== finding.owner ||
    notes !== finding.notes;

  async function save() {
    setSaving(true);
    try {
      const updated = await api.updateFinding(finding.id, { status, owner, notes });
      onSaved(normalizeFinding(updated, 0));
      toast.success(`Finding #${finding.id} updated`);
    } catch (e) {
      toast.error("Could not update finding", {
        description: e instanceof Error ? e.message : "Unexpected error.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-border/60 bg-secondary/20 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          Triage
        </div>
        <StatusBadge status={status} />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Status
          </label>
          <div className="mt-1.5 flex flex-wrap items-center gap-1 rounded-lg border border-border/70 bg-background/40 p-1">
            {FINDING_STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={`rounded-md px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors ${
                  status === s
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label
            htmlFor="finding-owner"
            className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground"
          >
            Owner
          </label>
          <Input
            id="finding-owner"
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            placeholder="Who owns remediation?"
            className="mt-1.5 h-9 text-[13px]"
          />
        </div>
      </div>

      <div className="mt-3">
        <label
          htmlFor="finding-notes"
          className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground"
        >
          Notes
        </label>
        <Textarea
          id="finding-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Triage rationale, ticket link, compensating control…"
          className="mt-1.5 min-h-[72px] text-[13px]"
        />
      </div>

      <div className="mt-3 flex justify-end">
        <Button size="sm" className="h-8 text-[12px]" disabled={saving || !dirty} onClick={save}>
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Save
        </Button>
      </div>
    </div>
  );
}
