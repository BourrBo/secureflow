import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Panel } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { API_URL } from "@/lib/api";

export const Route = createFileRoute("/dashboard/settings")({ component: Settings });

function Settings() {
  const { user, loading, signOut } = useAuth();
  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(" ");

  return (
    <>
      <PageHeader
        eyebrow="Workspace"
        title="Settings"
        description="Manage your account, notifications and programmatic access."
      />
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Your account" description="Details from your SecureFlow profile.">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-9" />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                {user?.avatar_url ? (
                  <img src={user.avatar_url} alt="" className="h-11 w-11 rounded-full" />
                ) : (
                  <div className="grid h-11 w-11 place-items-center rounded-full bg-[image:var(--gradient-primary)] text-sm font-semibold text-primary-foreground">
                    {(user?.first_name?.[0] ?? user?.email?.[0] ?? "?").toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{fullName || "—"}</div>
                  <div className="truncate text-[12px] text-muted-foreground">
                    {user?.email ?? "—"}
                  </div>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="fn" className="text-[11px]">
                    First name
                  </Label>
                  <Input
                    id="fn"
                    value={user?.first_name ?? ""}
                    readOnly
                    className="h-9 text-[13px]"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ln" className="text-[11px]">
                    Last name
                  </Label>
                  <Input
                    id="ln"
                    value={user?.last_name ?? ""}
                    readOnly
                    className="h-9 text-[13px]"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="em" className="text-[11px]">
                  Email
                </Label>
                <Input id="em" value={user?.email ?? ""} readOnly className="h-9 text-[13px]" />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Profile details come from your identity provider. The API has no profile-update
                endpoint yet, so these fields are read-only.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={signOut}>
                  Sign out
                </Button>
              </div>
            </div>
          )}
        </Panel>

        <Panel
          title="Notifications"
          description="Delivery preferences — not persisted yet; the API has no preferences endpoint."
        >
          <ul className="divide-y divide-border/60">
            {[
              "Email digest (daily)",
              "Critical findings — immediate",
              "Weekly posture summary",
              "New project connected",
            ].map((n, i) => (
              <li key={n} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                <span className="text-[13px]">{n}</span>
                <Switch defaultChecked={i < 2} />
              </li>
            ))}
          </ul>
        </Panel>

        <Panel
          title="Connection"
          description="Where this console reads its data from."
          className="lg:col-span-2"
        >
          <div className="rounded-lg border border-border/70 bg-secondary/25 p-4">
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              API endpoint
            </div>
            <div className="mt-1 truncate font-mono text-[13px]">{API_URL}</div>
            <p className="mt-2 text-[12px] text-muted-foreground">
              Set <span className="font-mono">VITE_API_URL</span> to point this console at a
              different SecureFlow API instance.
            </p>
          </div>
        </Panel>
      </div>
    </>
  );
}
