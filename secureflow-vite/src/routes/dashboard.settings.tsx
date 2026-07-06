import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Panel } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/dashboard/settings")({ component: Settings });

function Settings() {
  return (
    <>
      <PageHeader eyebrow="Workspace" title="Settings" description="Manage your workspace, team, and integrations." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Workspace" description="How your organization appears in SecureFlow.">
          <div className="space-y-4">
            <div className="space-y-2"><Label htmlFor="org">Organization name</Label><Input id="org" defaultValue="Acme, Inc." /></div>
            <div className="space-y-2"><Label htmlFor="slug">Workspace URL</Label><Input id="slug" defaultValue="app.secureflow.io/acme" /></div>
            <Button variant="hero" size="sm">Save changes</Button>
          </div>
        </Panel>
        <Panel title="Notifications" description="Where SecureFlow sends findings and alerts.">
          <ul className="divide-y divide-border/60">
            {["Email digest (daily)", "Slack — #security", "PagerDuty on Critical", "Jira auto-ticketing"].map((n, i) => (
              <li key={n} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <span className="text-sm">{n}</span>
                <Switch defaultChecked={i < 3} />
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="API keys" description="Programmatic access for CI/CD and custom integrations." className="lg:col-span-2">
          <div className="rounded-lg border border-border bg-secondary/40 p-4 font-mono text-sm">
            <div className="text-xs text-muted-foreground">Production key</div>
            <div className="mt-1 truncate">sk_live_·········································xR8q</div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button variant="outline" size="sm">Reveal</Button>
            <Button variant="outline" size="sm">Rotate</Button>
            <Button variant="hero" size="sm">Create new key</Button>
          </div>
        </Panel>
      </div>
    </>
  );
}