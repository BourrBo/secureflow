import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import {
  ShieldCheck, Code2, Package, KeyRound, Boxes, Container, Radar,
  GitBranch, Sparkles, ArrowRight, CheckCircle2, Zap, LineChart, Bot,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/site/Navbar";
import { Footer } from "@/components/site/Footer";
import { Terminal } from "@/components/site/Terminal";

export const Route = createFileRoute("/")({
  component: Landing,
});

const modules = [
  { icon: Code2, name: "SAST", desc: "Deep static analysis via Semgrep across 20+ languages — injection, XSS, auth flaws, 500+ patterns.", status: "Live", tone: "success" as const },
  { icon: Package, name: "SCA", desc: "OSV-Scanner surfaces vulnerable dependencies with CVSS + EPSS scoring and auto SBOM (CycloneDX / SPDX).", status: "Live", tone: "success" as const },
  { icon: KeyRound, name: "Secrets", desc: "Gitleaks with 800+ regex patterns — AWS keys, tokens, passwords, even in commit history.", status: "Live", tone: "success" as const },
  { icon: Boxes, name: "IaC", desc: "Scan Terraform, Helm, Kubernetes and CloudFormation with KICS before infra is ever provisioned.", status: "Live", tone: "success" as const },
  { icon: Container, name: "Container", desc: "Trivy-powered image scanning for Docker & Kubernetes — OS CVEs, misconfigs, baked-in secrets.", status: "Beta", tone: "info" as const },
  { icon: Bot, name: "AI Fix Engine", desc: "One-click remediation powered by Claude — context-aware, PR-ready fixes, not just suggestions.", status: "Soon", tone: "warning" as const },
];

const steps = [
  { n: "01", title: "Connect your repos", desc: "Link GitHub, GitLab, Bitbucket or Azure DevOps in one click. Auto-discovers your whole org." },
  { n: "02", title: "Scan on every PR", desc: "CI/CD plugin runs all enabled modules on push and pull request. Zero developer workflow change." },
  { n: "03", title: "Fix what matters", desc: "CVSS + EPSS prioritization surfaces the riskiest first. Assign, triage, and merge with confidence." },
];

const integrations = ["GitHub", "GitLab", "Bitbucket", "Azure DevOps", "Jira", "Slack", "Jenkins", "CircleCI", "AWS", "GCP", "Azure", "Datadog"];

const stats = [
  { k: "6", v: "Scanner modules" },
  { k: "500+", v: "Vulnerability patterns" },
  { k: "<3s", v: "Median scan time / file" },
  { k: "99.9%", v: "Platform uptime" },
];

const tiers = [
  { name: "Starter", price: "Free", tag: "For solo devs & OSS", features: ["3 repositories", "SAST + Secrets", "Community support", "SBOM export"], cta: "Start free", variant: "outline" as const },
  { name: "Team", price: "$29", per: "/dev / mo", tag: "For growing engineering teams", features: ["Unlimited repositories", "All 6 scanner modules", "AI Fix suggestions", "Jira / Slack sync", "SSO (Google / GitHub)"], cta: "Start 14-day trial", variant: "hero" as const, highlight: true },
  { name: "Enterprise", price: "Custom", tag: "For regulated & scale-ups", features: ["Self-hosted option", "SAML / SCIM", "Audit logs & SOC 2", "Compliance reports", "Dedicated success mgr"], cta: "Contact sales", variant: "outline" as const },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 hero-glow" />
        <div className="pointer-events-none absolute inset-0 grid-pattern" />
        <div className="relative mx-auto max-w-6xl px-6 pt-24 pb-20 text-center md:pt-32">
          <div className="animate-fade-up mx-auto inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-accent">
            <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse-dot" />
            SAST · SCA · Secrets · IaC · Container · DAST
          </div>
          <h1 className="animate-fade-up mt-6 font-display text-5xl font-bold leading-[1.05] tracking-tight md:text-7xl">
            Find every vulnerability.<br />
            <span className="gradient-text">Before they do.</span>
          </h1>
          <p className="animate-fade-up mx-auto mt-6 max-w-2xl text-base text-muted-foreground md:text-lg">
            SecureFlow unifies six security scanning modules in one developer-first platform — so your team ships fast without leaving the door open.
          </p>
          <div className="animate-fade-up mt-9 flex flex-wrap items-center justify-center gap-3">
            <Button asChild variant="hero" size="xl">
              <Link to="/signup">Start scanning free <ArrowRight className="h-4 w-4" /></Link>
            </Button>
            <Button asChild variant="glow" size="xl">
              <Link to="/dashboard">Live demo dashboard</Link>
            </Button>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
            {["No credit card", "Free forever tier", "SOC 2 Type II"].map((t) => (
              <span key={t} className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-success" />{t}</span>
            ))}
          </div>
          <div className="mt-16">
            <Terminal />
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-border/60 bg-sidebar/40">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-6 py-10 md:grid-cols-4">
          {stats.map((s) => (
            <div key={s.v}>
              <div className="font-display text-3xl font-bold gradient-text md:text-4xl">{s.k}</div>
              <div className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">{s.v}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-24">
        <div className="max-w-2xl">
          <div className="font-mono text-xs uppercase tracking-widest text-accent">// Security modules</div>
          <h2 className="mt-3 font-display text-4xl font-bold tracking-tight md:text-5xl">
            Every attack surface.<br /><span className="text-muted-foreground">One platform.</span>
          </h2>
          <p className="mt-4 text-muted-foreground">
            From your first line of code to production deployment — SecureFlow has every layer covered by best-in-class open-source engines, unified under one dashboard.
          </p>
        </div>
        <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-2 lg:grid-cols-3">
          {modules.map((m) => (
            <div key={m.name} className="group relative bg-card p-7 transition-colors hover:bg-secondary/60">
              <div className="flex items-center justify-between">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20 transition-transform group-hover:scale-105">
                  <m.icon className="h-5 w-5" />
                </div>
                <span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
                  m.tone === "success" ? "border-success/30 bg-success/10 text-success"
                  : m.tone === "info" ? "border-info/30 bg-info/10 text-info"
                  : "border-warning/30 bg-warning/10 text-warning"
                }`}>● {m.status}</span>
              </div>
              <h3 className="mt-5 font-display text-lg font-semibold">{m.name}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{m.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="relative border-t border-border/60 bg-sidebar/40">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <div className="text-center">
            <div className="font-mono text-xs uppercase tracking-widest text-accent">// Workflow</div>
            <h2 className="mt-3 font-display text-4xl font-bold tracking-tight md:text-5xl">From commit to clean in three steps</h2>
          </div>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {steps.map((s, i) => (
              <div key={s.n} className="surface-card relative rounded-2xl p-7">
                <div className="font-mono text-xs text-muted-foreground">STEP {s.n}</div>
                <div className="mt-2 font-display text-xl font-semibold">{s.title}</div>
                <p className="mt-3 text-sm text-muted-foreground">{s.desc}</p>
                {i < steps.length - 1 && (
                  <ArrowRight className="absolute -right-3 top-1/2 hidden h-5 w-5 -translate-y-1/2 text-primary md:block" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Integrations */}
      <section id="integrations" className="mx-auto max-w-6xl px-6 py-24">
        <div className="grid gap-12 md:grid-cols-[1fr_1.2fr] md:items-center">
          <div>
            <div className="font-mono text-xs uppercase tracking-widest text-accent">// Integrations</div>
            <h2 className="mt-3 font-display text-4xl font-bold tracking-tight md:text-5xl">Plugs into the stack you already run.</h2>
            <p className="mt-4 text-muted-foreground">Source control, CI/CD, chat, ticketing, cloud, observability — SecureFlow slots in without asking your team to change how they work.</p>
            <div className="mt-6 flex flex-wrap gap-2 text-sm">
              {["GitHub Actions", "GitLab CI", "Jenkins", "CircleCI"].map((t) => (
                <span key={t} className="rounded-full border border-border bg-secondary/40 px-3 py-1 text-muted-foreground">{t}</span>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {integrations.map((i) => (
              <div key={i} className="surface-card grid aspect-square place-items-center rounded-xl text-center text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
                <div className="flex flex-col items-center gap-2">
                  <GitBranch className="h-4 w-4 text-primary" />
                  {i}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonial */}
      <section className="mx-auto max-w-4xl px-6 pb-24">
        <div className="surface-card relative overflow-hidden rounded-3xl p-10 text-center">
          <Sparkles className="mx-auto h-6 w-6 text-accent" />
          <blockquote className="mt-4 font-display text-2xl font-medium leading-snug md:text-3xl">
            “We replaced four separate security tools with SecureFlow in a weekend. Our mean-time-to-remediation dropped 71% in the first month.”
          </blockquote>
          <div className="mt-6 text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">Priya Ramanathan</span> · VP Engineering, Northwind
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t border-border/60 bg-sidebar/40">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <div className="text-center">
            <div className="font-mono text-xs uppercase tracking-widest text-accent">// Pricing</div>
            <h2 className="mt-3 font-display text-4xl font-bold tracking-tight md:text-5xl">Simple, per-developer pricing.</h2>
            <p className="mt-3 text-muted-foreground">Start free forever. Scale when your team does.</p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {tiers.map((t) => (
              <div key={t.name} className={`surface-card relative rounded-2xl p-8 ${t.highlight ? "ring-1 ring-primary/40 shadow-[var(--shadow-glow)]" : ""}`}>
                {t.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[image:var(--gradient-primary)] px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-primary-foreground">Most popular</span>
                )}
                <div className="font-display text-lg font-semibold">{t.name}</div>
                <div className="mt-1 text-sm text-muted-foreground">{t.tag}</div>
                <div className="mt-6 flex items-baseline gap-1">
                  <span className="font-display text-4xl font-bold">{t.price}</span>
                  {t.per && <span className="text-sm text-muted-foreground">{t.per}</span>}
                </div>
                <ul className="mt-6 space-y-3 text-sm">
                  {t.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-muted-foreground">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button asChild variant={t.variant} className="mt-8 w-full">
                  <Link to="/signup">{t.cta}</Link>
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA band */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="relative overflow-hidden rounded-3xl border border-border bg-[image:var(--gradient-primary)] p-12 text-center">
          <div className="pointer-events-none absolute inset-0 grid-pattern opacity-40" />
          <div className="relative">
            <ShieldCheck className="mx-auto h-10 w-10 text-primary-foreground" />
            <h2 className="mt-4 font-display text-3xl font-bold text-primary-foreground md:text-4xl">Ship secure. Sleep well.</h2>
            <p className="mx-auto mt-3 max-w-xl text-primary-foreground/85">Set up your first scan in under two minutes. No credit card, no sales call.</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button asChild size="xl" className="bg-background text-foreground hover:bg-background/90">
                <Link to="/signup"><Zap className="h-4 w-4" />Start free</Link>
              </Button>
              <Button asChild size="xl" variant="ghost" className="text-primary-foreground hover:bg-primary-foreground/10">
                <Link to="/dashboard">See dashboard <ArrowRight className="h-4 w-4" /></Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
