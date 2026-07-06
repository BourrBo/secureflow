import { Link } from "@tanstack/react-router";
import { Shield } from "lucide-react";
import type { ReactNode } from "react";

export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="relative grid min-h-screen lg:grid-cols-2">
      <div className="pointer-events-none absolute inset-0 hero-glow lg:hidden" />
      <div className="relative flex flex-col justify-between p-8 lg:p-12">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-[image:var(--gradient-primary)]">
            <Shield className="h-4 w-4 text-primary-foreground" />
          </span>
          <span className="font-display text-lg font-bold">SecureFlow</span>
        </Link>
        <div className="mx-auto w-full max-w-sm">
          <h1 className="font-display text-3xl font-bold tracking-tight">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>}
        </div>
        <div className="text-xs text-muted-foreground">© {new Date().getFullYear()} SecureFlow, Inc.</div>
      </div>
      <div className="relative hidden overflow-hidden border-l border-border/60 bg-sidebar lg:block">
        <div className="pointer-events-none absolute inset-0 hero-glow" />
        <div className="pointer-events-none absolute inset-0 grid-pattern" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-accent">
            <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse-dot" />
            Trusted by 4,000+ teams
          </div>
          <blockquote className="max-w-md">
            <p className="font-display text-2xl font-medium leading-snug">
              "Six scanners, one workflow, zero context-switching. SecureFlow is now the first tool on every new repo."
            </p>
            <div className="mt-4 text-sm text-muted-foreground">Priya R. · VP Engineering, Northwind</div>
          </blockquote>
        </div>
      </div>
    </div>
  );
}