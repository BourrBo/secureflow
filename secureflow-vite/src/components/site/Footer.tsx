import { Link } from "@tanstack/react-router";
import { Shield, Github, Twitter, Linkedin } from "lucide-react";

export function Footer() {
  const cols = [
    { title: "Product", links: [["Features", "#features"], ["How it works", "#how"], ["Integrations", "#integrations"], ["Pricing", "#pricing"]] },
    { title: "Modules", links: [["SAST", "/dashboard/sast"], ["SCA", "/dashboard/sca"], ["Secrets", "/dashboard/secrets"], ["IaC", "/dashboard/iac"], ["Container", "/dashboard/container"], ["DAST", "/dashboard/dast"]] },
    { title: "Company", links: [["About", "#"], ["Careers", "#"], ["Security", "#"], ["Contact", "#"]] },
  ];
  return (
    <footer className="border-t border-border/60 bg-sidebar">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <Link to="/" className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-[image:var(--gradient-primary)]">
                <Shield className="h-4 w-4 text-primary-foreground" />
              </span>
              <span className="font-display text-lg font-bold">SecureFlow</span>
            </Link>
            <p className="mt-4 max-w-sm text-sm text-muted-foreground">
              The unified DevSecOps platform for teams that ship fast without leaving the door open.
            </p>
            <div className="mt-6 flex gap-3">
              {[Github, Twitter, Linkedin].map((Icon, i) => (
                <a key={i} href="#" className="grid h-9 w-9 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground">
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>
          {cols.map((c) => (
            <div key={c.title}>
              <div className="mb-4 text-sm font-semibold text-foreground">{c.title}</div>
              <ul className="space-y-3">
                {c.links.map(([label, href]) => (
                  <li key={label}>
                    <a href={href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">{label}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-border/60 pt-6 text-xs text-muted-foreground md:flex-row md:items-center">
          <div>© {new Date().getFullYear()} SecureFlow, Inc. All rights reserved.</div>
          <div className="flex gap-6"><a href="#">Privacy</a><a href="#">Terms</a><a href="#">Security</a></div>
        </div>
      </div>
    </footer>
  );
}