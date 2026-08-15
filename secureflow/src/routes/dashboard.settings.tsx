import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader, Panel } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TableSkeleton, EmptyState, ErrorState } from "@/components/dashboard/primitives";
import { apiKeysQuery, projectsQuery } from "@/lib/queries";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { API_URL } from "@/lib/api";
import { AlertTriangle, Copy, KeyRound, Plus } from "lucide-react";

export const Route = createFileRoute("/dashboard/settings")({ component: Settings });

const ALL_PROJECTS = "__all__";

function fmtDate(v?: string | null) {
  if (!v) return "Never";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}

function ApiKeysPanel() {
  const qc = useQueryClient();
  const keys = useQuery(apiKeysQuery());
  const projects = useQuery(projectsQuery());
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [projectId, setProjectId] = useState<string>(ALL_PROJECTS);
  const [rawKey, setRawKey] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () =>
      api.createApiKey(name.trim(), projectId === ALL_PROJECTS ? undefined : projectId),
    onSuccess: (r) => setRawKey(r.key),
    onError: (e) =>
      toast.error("Could not create key", {
        description: e instanceof Error ? e.message : undefined,
      }),
  });

  const revoke = useMutation({
    mutationFn: (id: string | number) => api.revokeApiKey(id),
    onSuccess: () => {
      toast.success("Key revoked");
      qc.invalidateQueries({ queryKey: ["api-keys"] });
    },
    onError: (e) =>
      toast.error("Could not revoke key", {
        description: e instanceof Error ? e.message : undefined,
      }),
  });

  const closeDialog = () => {
    setOpen(false);
    setRawKey(null);
    setName("");
    setProjectId(ALL_PROJECTS);
    create.reset();
    qc.invalidateQueries({ queryKey: ["api-keys"] });
  };

  return (
    <Panel
      title="API keys"
      description="Used by CI pipelines to call the SecureFlow gate."
      className="lg:col-span-2"
      actions={
        <Button variant="hero" size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> Generate new key
        </Button>
      }
    >
      {keys.error ? (
        <ErrorState error={keys.error} />
      ) : keys.isLoading ? (
        <TableSkeleton rows={3} cols={5} />
      ) : (keys.data?.length ?? 0) === 0 ? (
        <EmptyState
          icon={KeyRound}
          title="No API keys yet"
          description="Generate a key to authenticate CI gate checks and SARIF downloads."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead>
              <tr className="border-b border-border/60 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                <th className="py-2 pr-3 font-normal">Name</th>
                <th className="py-2 pr-3 font-normal">Key</th>
                <th className="py-2 pr-3 font-normal">Created</th>
                <th className="py-2 pr-3 font-normal">Last used</th>
                <th className="py-2 font-normal"></th>
              </tr>
            </thead>
            <tbody>
              {(keys.data ?? []).map((k) => {
                const revoked = Boolean(k.revoked_at);
                return (
                  <tr key={String(k.id)} className="border-b border-border/40">
                    <td className="py-2 pr-3">{k.name}</td>
                    <td className="py-2 pr-3 font-mono">{k.key_prefix}••••••••</td>
                    <td className="py-2 pr-3">{fmtDate(k.created_at)}</td>
                    <td className="py-2 pr-3">{fmtDate(k.last_used_at)}</td>
                    <td className="py-2 text-right">
                      {revoked ? (
                        <span className="text-[11px] text-muted-foreground">Revoked</span>
                      ) : (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm" className="h-7 text-[11px]">
                              Revoke
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Revoke “{k.name}”?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Any pipeline using this key will start failing immediately. This
                                cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => revoke.mutate(k.id)}>
                                Revoke key
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : closeDialog())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{rawKey ? "Key created" : "Generate API key"}</DialogTitle>
            <DialogDescription>
              {rawKey
                ? "Store this key in your CI secret manager."
                : "Give the key a name so you can recognise it later."}
            </DialogDescription>
          </DialogHeader>

          {rawKey ? (
            <div className="space-y-3">
              <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-[12px] text-warning">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>This is the only time you'll see this key — copy it now.</span>
              </div>
              <div className="flex items-center gap-2">
                <Input readOnly value={rawKey} className="h-9 font-mono text-[12px]" />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(rawKey);
                      toast.success("Key copied");
                    } catch {
                      toast.error("Could not copy to clipboard");
                    }
                  }}
                >
                  <Copy className="h-3.5 w-3.5" /> Copy
                </Button>
              </div>
              <DialogFooter>
                <Button size="sm" onClick={closeDialog}>
                  Done
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="key-name" className="text-[11px]">
                  Name
                </Label>
                <Input
                  id="key-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. GitHub Actions"
                  className="h-9 text-[13px]"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px]">Project</Label>
                <Select value={projectId} onValueChange={setProjectId}>
                  <SelectTrigger className="h-9 text-[13px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_PROJECTS}>All projects</SelectItem>
                    {(projects.data ?? []).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button
                  size="sm"
                  disabled={create.isPending}
                  onClick={() => {
                    if (!name.trim()) {
                      toast.error("Enter a name for the key.");
                      return;
                    }
                    create.mutate();
                  }}
                >
                  {create.isPending ? "Creating…" : "Create"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Panel>
  );
}

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
        <Panel
          title="Your account"
          description="Details from your SecureFlow profile."
          className="lg:col-span-2"
        >
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

        <ApiKeysPanel />
      </div>
    </>
  );
}
