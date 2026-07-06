const lines: Array<{ type: string; text?: string; parts?: Array<{ c: string; t?: string }> }> = [
  { type: "cmd", text: "secureflow scan --project api-gateway --all-modules" },
  { type: "muted", text: "# Initializing SecureFlow v2.1.0" },
  { type: "ok", text: " Connected to GitHub · acme/api-gateway · branch: main" },
  { type: "row", parts: [{ c: "✓", t: "ok" }, { c: " SAST (Semgrep)      " }, { c: "8 Critical", t: "crit" }, { c: ", " }, { c: "14 High", t: "high" }, { c: ", 22 Medium" }] },
  { type: "row", parts: [{ c: "✓", t: "ok" }, { c: " SCA (OSV-Scanner)   " }, { c: "3 CVEs", t: "high" }, { c: " · CVSS 9.1 in lodash@4.17.20" }] },
  { type: "row", parts: [{ c: "✓", t: "ok" }, { c: " Secrets (Gitleaks)  " }, { c: "2 AWS keys exposed", t: "crit" }] },
  { type: "row", parts: [{ c: "✓", t: "ok" }, { c: " IaC (KICS)          " }, { c: "5 misconfigs", t: "high" }, { c: " in terraform/main.tf" }] },
  { type: "row", parts: [{ c: "✓", t: "ok" }, { c: " Container (Trivy)   " }, { c: "Clean", t: "ok" }] },
  { type: "muted", text: "# ─────────────────────────────────────────" },
  { type: "row", parts: [{ c: "→", t: "info" }, { c: " Security score: " }, { c: "64/100", t: "high" }, { c: " · PR blocked · Jira tickets created" }] },
  { type: "row", parts: [{ c: "→", t: "info" }, { c: " Full report: " }, { c: "app.secureflow.io/r/ag-2025", t: "info" }] },
];

const color = (t?: string) =>
  t === "ok" ? "text-[oklch(0.78_0.17_155)]"
  : t === "crit" ? "text-[oklch(0.70_0.22_20)]"
  : t === "high" ? "text-[oklch(0.80_0.15_75)]"
  : t === "info" ? "text-[oklch(0.78_0.14_220)]"
  : "text-muted-foreground";

export function Terminal() {
  return (
    <div className="surface-card mx-auto max-w-3xl overflow-hidden rounded-2xl">
      <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
        <span className="h-3 w-3 rounded-full bg-[oklch(0.70_0.22_20)]/70" />
        <span className="h-3 w-3 rounded-full bg-[oklch(0.80_0.15_75)]/70" />
        <span className="h-3 w-3 rounded-full bg-[oklch(0.78_0.17_155)]/70" />
        <span className="ml-3 font-mono text-xs text-muted-foreground">secureflow ~ scan</span>
        <span className="ml-auto flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse-dot" />
          LIVE
        </span>
      </div>
      <div className="bg-[oklch(0.12_0.02_260)] p-5 text-left font-mono text-[13px] leading-relaxed">
        {lines.map((l, i) => (
          <div key={i} className={l.type === "cmd" ? "text-foreground" : l.type === "muted" ? "text-muted-foreground/60" : l.type === "ok" ? "text-[oklch(0.78_0.17_155)]" : ""}>
            {l.type === "cmd" && <span className="text-primary">$ </span>}
            {l.text}
            {l.parts?.map((p, j) => <span key={j} className={color(p.t)}>{p.c}</span>)}
          </div>
        ))}
      </div>
    </div>
  );
}