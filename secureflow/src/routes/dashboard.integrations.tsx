import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  PageHeader,
  Panel,
  EmptyState,
  ErrorState,
  TableSkeleton,
} from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  api,
  isForbidden,
  type ApiIntegration,
  type ApiMyOrganization,
  type ApiOrgRole,
} from "@/lib/api";
import {
  clearOrganizationState,
  normalizeOrgId,
  readStoredOrgId,
  writeStoredOrgId,
} from "@/lib/organization";
import { useAuth } from "@/lib/auth";
import { useIntegrationScan } from "@/lib/integrationScan";
import {
  AlertTriangle,
  Building2,
  Copy,
  Container,
  Github,
  GitBranch,
  GitFork,
  KeyRound,
  Plug,
  Plus,
  ScanLine,
  Trash2,
  Users,
} from "lucide-react";

export const Route = createFileRoute("/dashboard/integrations")({
  validateSearch: (search: Record<string, unknown>) => ({
    connected: typeof search.connected === "string" ? search.connected : undefined,
    error: typeof search.error === "string" ? search.error : undefined,
  }),
  component: IntegrationsPage,
});

const VALID_SCOPES = [
  "projects:read",
  "projects:write",
  "scans:read",
  "scans:run",
  "findings:read",
  "reports:read",
  "settings:manage",
  "integrations:manage",
];

function fmtDate(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}

function errMsg(e: unknown) {
  return e instanceof Error ? e.message : undefined;
}

/* ── Organization switcher / creation ────────────────────────────── */

const myOrganizationsQueryKey = ["my-organizations"] as const;

function useMyOrganizations() {
  return useQuery({
    queryKey: myOrganizationsQueryKey,
    queryFn: () => api.listMyOrganizations().then((r) => r.organizations),
    staleTime: 15_000,
  });
}

function useOrganizationId() {
  const [organizationId, setOrganizationIdState] = useState<number | null>(() => readStoredOrgId());
  const setOrganizationId = useCallback((id: number | null) => {
    const valid = normalizeOrgId(id);
    setOrganizationIdState(valid);
    writeStoredOrgId(valid);
  }, []);
  const clearOrganization = useCallback(() => {
    setOrganizationIdState(null);
    clearOrganizationState();
  }, []);
  return { organizationId, setOrganizationId, clearOrganization };
}

const ROLE_LABEL: Record<ApiOrgRole, string> = {
  owner: "Owner",
  admin: "Admin",
  security: "Security",
  viewer: "Viewer",
};

function MyOrganizationsList({
  currentOrganizationId,
  onPick,
  onDeleted,
}: {
  currentOrganizationId: number | null;
  onPick: (id: number) => void;
  onDeleted: (id: number) => void;
}) {
  const qc = useQueryClient();
  const myOrgs = useMyOrganizations();

  const remove = useMutation({
    mutationFn: (id: number) => api.deleteOrganization(id),
    onSuccess: async (_r, id) => {
      toast.success("Organization removed");
      // Drop every cached org-scoped slice for the deleted org before the
      // list refetches, so nothing re-requests it and 403s.
      qc.removeQueries({ queryKey: ["integrations", id] });
      qc.removeQueries({ queryKey: ["org-api-keys", id] });
      qc.removeQueries({ queryKey: ["repositories"] });
      qc.removeQueries({ queryKey: ["registry-images", id] });
      onDeleted(id);
      await qc.invalidateQueries({ queryKey: myOrganizationsQueryKey });
    },
    onError: (e) => toast.error("Could not remove organization", { description: errMsg(e) }),
  });

  if (myOrgs.isLoading) {
    return <TableSkeleton rows={2} cols={1} />;
  }
  if (myOrgs.error) {
    return <ErrorState error={myOrgs.error} />;
  }
  if (!myOrgs.data || myOrgs.data.length === 0) {
    return null;
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-[11px]">Your organizations</Label>
      <div className="space-y-1.5">
        {myOrgs.data.map((org: ApiMyOrganization) => {
          const isCurrent = org.id === currentOrganizationId;
          // Only owners/admins get the destructive affordance; the backend
          // still enforces this, the UI just doesn't tease it.
          const canManage = org.role === "owner" || org.role === "admin";
          return (
            <div
              key={org.id}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-[13px] ${
                isCurrent ? "border-primary/40 bg-primary/5" : "border-border/70 bg-secondary/25"
              }`}
            >
              <button
                type="button"
                onClick={() => onPick(org.id)}
                disabled={isCurrent}
                className="flex min-w-0 flex-1 items-center gap-2 text-left disabled:cursor-default"
              >
                <span className="truncate">
                  <span className="font-medium">{org.name}</span>{" "}
                  <span className="text-[11px] text-muted-foreground">#{org.id}</span>
                </span>
                {isCurrent && <Badge className="shrink-0 text-[10px]">Current</Badge>}
              </button>
              <Badge variant="outline" className="shrink-0 text-[10px]">
                {ROLE_LABEL[org.role]}
              </Badge>
              {canManage && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-critical"
                      aria-label={`Remove ${org.name}`}
                      disabled={remove.isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remove “{org.name}”?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This permanently removes organization #{org.id} along with its integrations,
                        members and API keys.
                        {isCurrent && " It is your currently selected organization."} This cannot be
                        undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => remove.mutate(org.id)}>
                        Yes, remove it
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OrganizationPanel({
  organizationId,
  onSelect,
  onClear,
}: {
  organizationId: number | null;
  onSelect: (id: number) => void;
  onClear: () => void;
}) {
  const [name, setName] = useState("");
  // Switching starts true whenever there's no active org yet, so the
  // picker/create form shows by default. "Switch organization" flips it
  // back on without ever setting organizationId to a sentinel value —
  // that's what used to make the whole page appear to just disappear.
  const [switching, setSwitching] = useState(organizationId === null);

  const create = useMutation({
    mutationFn: () => api.createOrganization(name.trim()),
    onSuccess: (org) => {
      toast.success(`Organization "${org.name}" created`);
      setSwitching(false);
      onSelect(org.id);
      setName("");
    },
    onError: (e) => toast.error("Could not create organization", { description: errMsg(e) }),
  });

  const pick = (id: number) => {
    setSwitching(false);
    onSelect(id);
  };

  const showPicker = organizationId === null || switching;

  return (
    <Panel
      title="Organization"
      description="Every integration, role, and API key belongs to an organization."
      className="lg:col-span-2"
    >
      {!showPicker && organizationId ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 bg-secondary/25 p-4">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Active organization
            </div>
            <div className="mt-1 text-[13px] font-medium">#{organizationId}</div>
          </div>
          <Button variant="outline" size="sm" onClick={() => setSwitching(true)}>
            Switch organization
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {organizationId !== null && (
            <div className="flex items-center justify-between">
              <p className="text-[12px] text-muted-foreground">
                Pick an organization below, or create a new one.
              </p>
              <Button variant="ghost" size="sm" onClick={() => setSwitching(false)}>
                Cancel
              </Button>
            </div>
          )}

          <MyOrganizationsList
            currentOrganizationId={organizationId}
            onPick={pick}
            onDeleted={(id) => {
              // Only the active selection is affected; other orgs stay put.
              if (id === organizationId) {
                onClear();
                setSwitching(true);
              }
            }}
          />

          <div className="space-y-3 border-t border-border/50 pt-4">
            <p className="text-[13px] text-muted-foreground">
              Create an organization to connect source control, registries, and manage access. You
              become its Owner automatically.
            </p>
            <div className="flex gap-2">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Acme Security"
                className="h-9 max-w-xs text-[13px]"
              />
              <Button
                size="sm"
                disabled={create.isPending || !name.trim()}
                onClick={() => create.mutate()}
              >
                <Plus className="h-3.5 w-3.5" />{" "}
                {create.isPending ? "Creating…" : "Create organization"}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Already have an organization ID from a teammate? Ask them to add you as a member, then
              enter it below.
            </p>
            <OrgIdEntry onSelect={pick} />
          </div>
        </div>
      )}
    </Panel>
  );
}

function OrgIdEntry({ onSelect }: { onSelect: (id: number) => void }) {
  const [raw, setRaw] = useState("");
  return (
    <div className="flex gap-2">
      <Input
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        placeholder="Organization ID"
        className="h-8 max-w-[160px] text-[12px]"
      />
      <Button
        variant="outline"
        size="sm"
        disabled={normalizeOrgId(raw) === null}
        onClick={() => {
          const id = normalizeOrgId(raw);
          if (id) onSelect(id);
        }}
      >
        Use this org
      </Button>
    </div>
  );
}

/* ── Members / roles ─────────────────────────────────────────────── */

function MembersPanel({ organizationId }: { organizationId: number }) {
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<ApiOrgRole>("viewer");
  const upsert = useMutation({
    mutationFn: () => api.upsertMember(organizationId, userId.trim(), role),
    onSuccess: (m) => {
      toast.success(`${m.user_id} is now ${ROLE_LABEL[m.role]}`);
      setUserId("");
    },
    onError: (e) => toast.error("Could not update member", { description: errMsg(e) }),
  });

  return (
    <Panel
      title="Access & roles"
      description="Owner, Admin, Security, and Viewer — enforced on every request by the backend, not just hidden in the UI."
      className="lg:col-span-2"
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr,160px,auto]">
        <div className="space-y-1.5">
          <Label className="text-[11px]">User ID (Supabase user id)</Label>
          <Input
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="00000000-0000-0000-0000-000000000000"
            className="h-9 text-[13px]"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[11px]">Role</Label>
          <Select value={role} onValueChange={(v) => setRole(v as ApiOrgRole)}>
            <SelectTrigger className="h-9 text-[13px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="security">Security</SelectItem>
              <SelectItem value="viewer">Viewer</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end">
          <Button
            size="sm"
            className="h-9"
            disabled={upsert.isPending || !userId.trim()}
            onClick={() => upsert.mutate()}
          >
            {upsert.isPending ? "Saving…" : "Add / update member"}
          </Button>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-4">
        {(["owner", "admin", "security", "viewer"] as const).map((r) => (
          <div key={r} className="rounded-lg border border-border/60 bg-secondary/20 p-3">
            <div className="text-[12px] font-medium">{ROLE_LABEL[r]}</div>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              {r === "owner" && "Full control, including billing-equivalent actions."}
              {r === "admin" && "Manage members, integrations, API keys, and settings."}
              {r === "security" && "Run scans and manage projects; no member/settings access."}
              {r === "viewer" && "Read-only access to projects, scans, findings, reports."}
            </p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/* ── Source control: GitHub + GitLab + Bitbucket ──────────────────── */

type SourceProvider = "github" | "gitlab" | "bitbucket";

const SOURCE_PROVIDER_CONFIG: Record<
  SourceProvider,
  {
    label: string;
    icon: typeof Github;
    description: string;
    authorize: (organizationId: number) => ReturnType<typeof api.githubAuthorize>;
    listRepositories: (
      organizationId: number,
      integrationId: number,
    ) => ReturnType<typeof api.githubRepositories>;
    selectRepository: (
      organizationId: number,
      integrationId: number,
      fullName: string,
    ) => ReturnType<typeof api.selectGithubRepository>;
  }
> = {
  github: {
    label: "GitHub",
    icon: Github,
    description: "Connect GitHub → OAuth → repository list → select repo → scan.",
    authorize: api.githubAuthorize,
    listRepositories: api.githubRepositories,
    selectRepository: api.selectGithubRepository,
  },
  gitlab: {
    label: "GitLab",
    icon: GitBranch,
    description:
      "Connect GitLab (gitlab.com or self-hosted) → authorize → pick a project → scan.",
    authorize: api.gitlabAuthorize,
    listRepositories: api.gitlabRepositories,
    selectRepository: api.selectGitlabRepository,
  },
  bitbucket: {
    label: "Bitbucket",
    icon: GitFork,
    description: "Connect Bitbucket → OAuth → repository list → select repo → scan.",
    authorize: api.bitbucketAuthorize,
    listRepositories: api.bitbucketRepositories,
    selectRepository: api.selectBitbucketRepository,
  },
};

/**
 * Only ever fires for a validated, positive organization ID — never for the
 * old `?? 0` sentinel — and never retries a 403/404, which means the org is
 * gone or the caller lost access rather than a transient failure.
 */
function useIntegrations(organizationId: number | null) {
  return useQuery({
    queryKey: ["integrations", organizationId ?? 0],
    queryFn: () => api.listIntegrations(organizationId!).then((r) => r.integrations),
    enabled: organizationId !== null,
    retry: (count, error) => !isForbidden(error) && count < 1,
    staleTime: 15_000,
  });
}

function SourceControlProvider({
  organizationId,
  provider,
  integrations,
}: {
  organizationId: number;
  provider: SourceProvider;
  integrations: ApiIntegration[];
}) {
  const qc = useQueryClient();
  const config = SOURCE_PROVIDER_CONFIG[provider];
  const active = integrations.filter((i) => i.provider === provider && i.status === "connected");

  const connect = useMutation({
    mutationFn: () => config.authorize(organizationId),
    onSuccess: (r) => {
      window.location.href = r.authorize_url;
    },
    onError: (e) => toast.error("Could not start OAuth", { description: errMsg(e) }),
  });

  const disconnect = useMutation({
    mutationFn: (integrationId: number) => api.disconnectIntegration(organizationId, integrationId),
    onSuccess: () => {
      toast.success("Disconnected");
      qc.invalidateQueries({ queryKey: ["integrations", organizationId] });
    },
    onError: (e) => toast.error("Could not disconnect", { description: errMsg(e) }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[12px] text-muted-foreground">{config.description}</p>
        <Button
          size="sm"
          variant="hero"
          disabled={connect.isPending}
          onClick={() => connect.mutate()}
        >
          <Plug className="h-3.5 w-3.5" /> Connect {config.label}
        </Button>
      </div>

      {active.length === 0 ? (
        <EmptyState
          icon={config.icon}
          title={`No ${config.label} connection yet`}
          description="Connect to browse repositories and run scans without pasting credentials."
        />
      ) : (
        <div className="space-y-3">
          {active.map((integration) => (
            <RepositoryCard
              key={integration.id}
              organizationId={organizationId}
              integration={integration}
              provider={provider}
              onDisconnect={() => disconnect.mutate(integration.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RepositoryCard({
  organizationId,
  integration,
  provider,
  onDisconnect,
}: {
  organizationId: number;
  integration: ApiIntegration;
  provider: SourceProvider;
  onDisconnect: () => void;
}) {
  const qc = useQueryClient();
  const [browsing, setBrowsing] = useState(false);
  const config = SOURCE_PROVIDER_CONFIG[provider];

  const repos = useQuery({
    queryKey: ["repositories", provider, organizationId, integration.id],
    queryFn: () =>
      config.listRepositories(organizationId, integration.id).then((r) => r.repositories),
    enabled: browsing,
  });

  const select = useMutation({
    mutationFn: (fullName: string) =>
      config.selectRepository(organizationId, integration.id, fullName),
    onSuccess: () => {
      toast.success("Repository selected");
      setBrowsing(false);
      qc.invalidateQueries({ queryKey: ["integrations", organizationId] });
    },
    onError: (e) => toast.error("Could not select repository", { description: errMsg(e) }),
  });

  // Runs through the shared background-scan context, so switching tabs mid
  // scan keeps tracking it and coming back reconnects instead of restarting.
  const scan = useIntegrationScan(provider, organizationId, integration.id);

  const selectedRepo = (
    integration.metadata as { selected_repository?: { full_name?: string; private?: boolean } }
  )?.selected_repository;

  return (
    <div className="rounded-lg border border-border/70 bg-secondary/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[13px] font-medium">{integration.name}</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            Connected {fmtDate(integration.created_at)}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setBrowsing((b) => !b)}>
            {browsing ? "Hide repositories" : "Browse repositories"}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-critical">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Disconnect {integration.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  Revokes this connection. You'll need to reauthorize to reconnect.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onDisconnect}>Disconnect</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {selectedRepo?.full_name && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2">
          <span className="font-mono text-[12px]">{selectedRepo.full_name}</span>
          {selectedRepo.private && (
            <Badge variant="outline" className="text-[10px]">
              private
            </Badge>
          )}
          <Button
            size="sm"
            variant="hero"
            className="ml-auto h-7 text-[11px]"
            disabled={scan.running !== null}
            onClick={() => scan.start(selectedRepo.full_name ?? integration.name)}
          >
            <ScanLine className="h-3.5 w-3.5" /> {scan.running ? "Scanning…" : "Scan"}
          </Button>
        </div>
      )}
      {scan.running && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Scanning {scan.running.label} — keeps running while you browse other pages.
        </p>
      )}
      {!scan.running && scan.result && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Last scan: {scan.result.label} —{" "}
          {scan.result.ok
            ? `${scan.result.count} finding${scan.result.count === 1 ? "" : "s"}`
            : "failed"}
        </p>
      )}

      {browsing && (
        <div className="mt-3 max-h-64 overflow-y-auto rounded-md border border-border/60">
          {repos.error ? (
            <ErrorState error={repos.error} />
          ) : repos.isLoading ? (
            <div className="p-3">
              <TableSkeleton rows={4} cols={1} />
            </div>
          ) : (repos.data?.length ?? 0) === 0 ? (
            <div className="p-4 text-center text-[12px] text-muted-foreground">
              No accessible repositories found.
            </div>
          ) : (
            <ul className="divide-y divide-border/50">
              {(repos.data ?? []).map((repo) => (
                <li
                  key={repo.id}
                  className="flex items-center justify-between gap-3 px-3 py-2 text-[12px]"
                >
                  <span className="truncate font-mono">{repo.full_name}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 shrink-0 text-[11px]"
                    disabled={select.isPending}
                    onClick={() => select.mutate(repo.full_name)}
                  >
                    Select
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Container registries ────────────────────────────────────────── */

const REGISTRY_FIELDS: Record<string, { key: string; label: string; secret?: boolean }[]> = {
  dockerhub: [
    { key: "username", label: "Username" },
    { key: "password", label: "Access token", secret: true },
  ],
  ghcr: [
    { key: "username", label: "GitHub username" },
    { key: "token", label: "PAT (read:packages)", secret: true },
  ],
  ecr: [
    { key: "access_key_id", label: "Access key ID" },
    { key: "secret_access_key", label: "Secret access key", secret: true },
    { key: "region", label: "Region (e.g. us-east-1)" },
  ],
};

function RegistriesPanel({
  organizationId,
  integrations,
}: {
  organizationId: number;
  integrations: ApiIntegration[];
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState<"dockerhub" | "ecr" | "ghcr">("dockerhub");
  const [name, setName] = useState("");
  const [creds, setCreds] = useState<Record<string, string>>({});

  const registries = integrations.filter(
    (i) => ["dockerhub", "ecr", "ghcr"].includes(i.provider) && i.status === "connected",
  );

  const connect = useMutation({
    mutationFn: () => api.connectRegistry(organizationId, provider, name.trim(), creds),
    onSuccess: () => {
      toast.success("Registry connected — credentials verified");
      setOpen(false);
      setName("");
      setCreds({});
      qc.invalidateQueries({ queryKey: ["integrations", organizationId] });
    },
    onError: (e) => toast.error("Could not verify credentials", { description: errMsg(e) }),
  });

  const disconnect = useMutation({
    mutationFn: (integrationId: number) => api.disconnectIntegration(organizationId, integrationId),
    onSuccess: () => {
      toast.success("Registry disconnected");
      qc.invalidateQueries({ queryKey: ["integrations", organizationId] });
    },
    onError: (e) => toast.error("Could not disconnect", { description: errMsg(e) }),
  });

  const fields = REGISTRY_FIELDS[provider];

  return (
    <Panel
      title="Container registries"
      description="Docker Hub, Amazon ECR, GHCR — credentials are verified against the real provider before a connection is saved, and never echoed back."
      className="lg:col-span-2"
      actions={
        <Button size="sm" variant="hero" onClick={() => setOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> Connect registry
        </Button>
      }
    >
      {registries.length === 0 ? (
        <EmptyState
          icon={Container}
          title="No registries connected"
          description="Connect a registry to browse images and run container scans."
        />
      ) : (
        <div className="space-y-3">
          {registries.map((integration) => (
            <RegistryCard
              key={integration.id}
              organizationId={organizationId}
              integration={integration}
              onDisconnect={() => disconnect.mutate(integration.id)}
            />
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect a registry</DialogTitle>
            <DialogDescription>
              Credentials are validated live and stored encrypted — this backend never keeps
              plaintext credentials.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-[11px]">Provider</Label>
              <Select
                value={provider}
                onValueChange={(v) => {
                  setProvider(v as typeof provider);
                  setCreds({});
                }}
              >
                <SelectTrigger className="h-9 text-[13px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dockerhub">Docker Hub</SelectItem>
                  <SelectItem value="ecr">Amazon ECR</SelectItem>
                  <SelectItem value="ghcr">GHCR</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px]">Connection name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Prod ECR"
                className="h-9 text-[13px]"
              />
            </div>
            {fields.map((f) => (
              <div key={f.key} className="space-y-1.5">
                <Label className="text-[11px]">{f.label}</Label>
                <Input
                  type={f.secret ? "password" : "text"}
                  value={creds[f.key] ?? ""}
                  onChange={(e) => setCreds((c) => ({ ...c, [f.key]: e.target.value }))}
                  className="h-9 text-[13px]"
                />
              </div>
            ))}
            <DialogFooter>
              <Button
                size="sm"
                disabled={
                  connect.isPending || !name.trim() || fields.some((f) => !creds[f.key]?.trim())
                }
                onClick={() => connect.mutate()}
              >
                {connect.isPending ? "Verifying…" : "Connect"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </Panel>
  );
}

function RegistryCard({
  organizationId,
  integration,
  onDisconnect,
}: {
  organizationId: number;
  integration: ApiIntegration;
  onDisconnect: () => void;
}) {
  const qc = useQueryClient();
  const [browsing, setBrowsing] = useState(false);

  const images = useQuery({
    queryKey: ["registry-images", organizationId, integration.id],
    queryFn: () => api.registryImages(organizationId, integration.id).then((r) => r.images),
    enabled: browsing,
  });

  const scan = useIntegrationScan("registry", organizationId, integration.id);

  const selectImage = useMutation({
    mutationFn: (repository: string) =>
      api.selectRegistryImage(organizationId, integration.id, {
        repository,
        reference_prefix: repository,
        tag: "latest",
      }),
    onSuccess: () => {
      toast.success("Image selected (tag: latest — adjust before scanning if needed)");
      qc.invalidateQueries({ queryKey: ["integrations", organizationId] });
    },
    onError: (e) => toast.error("Could not select image", { description: errMsg(e) }),
  });

  const selected = (
    integration.metadata as { selected_image?: { repository?: string; tag?: string } }
  )?.selected_image;

  return (
    <div className="rounded-lg border border-border/70 bg-secondary/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 text-[13px] font-medium">
            {integration.name}
            <Badge variant="outline" className="text-[10px] uppercase">
              {integration.provider}
            </Badge>
          </div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            Connected {fmtDate(integration.created_at)}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setBrowsing((b) => !b)}>
            {browsing ? "Hide images" : "Browse images"}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-critical">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Disconnect {integration.name}?</AlertDialogTitle>
                <AlertDialogDescription>Revokes this registry connection.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onDisconnect}>Disconnect</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {selected?.repository && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2">
          <span className="font-mono text-[12px]">
            {selected.repository}:{selected.tag}
          </span>
          <Button
            size="sm"
            variant="hero"
            className="ml-auto h-7 text-[11px]"
            disabled={scan.running !== null}
            onClick={() => scan.start(`${selected.repository}:${selected.tag ?? "latest"}`)}
          >
            <ScanLine className="h-3.5 w-3.5" /> {scan.running ? "Scanning…" : "Scan"}
          </Button>
        </div>
      )}
      {scan.running && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Scanning {scan.running.label} — keeps running while you browse other pages.
        </p>
      )}
      {!scan.running && scan.result && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Last scan: {scan.result.label} —{" "}
          {scan.result.ok
            ? `${scan.result.count} finding${scan.result.count === 1 ? "" : "s"}`
            : "failed"}
        </p>
      )}

      {browsing && (
        <div className="mt-3 max-h-64 overflow-y-auto rounded-md border border-border/60">
          {images.error ? (
            <ErrorState error={images.error} />
          ) : images.isLoading ? (
            <div className="p-3">
              <TableSkeleton rows={4} cols={1} />
            </div>
          ) : (images.data?.length ?? 0) === 0 ? (
            <div className="p-4 text-center text-[12px] text-muted-foreground">
              No images found.
            </div>
          ) : (
            <ul className="divide-y divide-border/50">
              {(images.data ?? []).map((img) => (
                <li
                  key={img.repository}
                  className="flex items-center justify-between gap-3 px-3 py-2 text-[12px]"
                >
                  <span className="truncate font-mono">{img.repository}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 shrink-0 text-[11px]"
                    disabled={selectImage.isPending}
                    onClick={() => selectImage.mutate(img.repository)}
                  >
                    Select
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Org-scoped API keys ─────────────────────────────────────────── */

function OrgApiKeysPanel({ organizationId }: { organizationId: number }) {
  const qc = useQueryClient();
  const keys = useQuery({
    queryKey: ["org-api-keys", organizationId],
    queryFn: () => api.listOrgApiKeys(organizationId).then((r) => r.keys),
    retry: (count, error) => !isForbidden(error) && count < 1,
  });

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>(["scans:run", "findings:read"]);
  const [rawKey, setRawKey] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () => api.createOrgApiKey(organizationId, name.trim(), scopes),
    onSuccess: (r) => setRawKey(r.key),
    onError: (e) => toast.error("Could not create key", { description: errMsg(e) }),
  });

  const revoke = useMutation({
    mutationFn: (id: number) => api.revokeOrgApiKey(organizationId, id),
    onSuccess: () => {
      toast.success("Key revoked");
      qc.invalidateQueries({ queryKey: ["org-api-keys", organizationId] });
    },
    onError: (e) => toast.error("Could not revoke key", { description: errMsg(e) }),
  });

  const closeDialog = () => {
    setOpen(false);
    setRawKey(null);
    setName("");
    setScopes(["scans:run", "findings:read"]);
    create.reset();
    qc.invalidateQueries({ queryKey: ["org-api-keys", organizationId] });
  };

  return (
    <Panel
      title="Organization API keys"
      description="Scoped keys for CI/CD, shown once at creation and stored only as a hash."
      className="lg:col-span-2"
      actions={
        <Button variant="hero" size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> Create key
        </Button>
      }
    >
      {keys.error ? (
        <ErrorState error={keys.error} />
      ) : keys.isLoading ? (
        <TableSkeleton rows={3} cols={4} />
      ) : (keys.data?.length ?? 0) === 0 ? (
        <EmptyState icon={KeyRound} title="No organization API keys yet" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead>
              <tr className="border-b border-border/60 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                <th className="py-2 pr-3 font-normal">Name</th>
                <th className="py-2 pr-3 font-normal">Key</th>
                <th className="py-2 pr-3 font-normal">Scopes</th>
                <th className="py-2 pr-3 font-normal">Created</th>
                <th className="py-2 font-normal" />
              </tr>
            </thead>
            <tbody>
              {(keys.data ?? []).map((k) => {
                const revoked = Boolean(k.revoked_at);
                return (
                  <tr key={k.id} className="border-b border-border/40">
                    <td className="py-2 pr-3">{k.name}</td>
                    <td className="py-2 pr-3 font-mono">{k.key_prefix}••••••••</td>
                    <td className="py-2 pr-3">
                      <div className="flex flex-wrap gap-1">
                        {k.scopes.map((s) => (
                          <Badge key={s} variant="outline" className="text-[9px]">
                            {s}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="py-2 pr-3">{fmtDate(k.created_at)}</td>
                    <td className="py-2 text-right">
                      {revoked ? (
                        <span className="text-[11px] text-muted-foreground">Revoked</span>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-[11px]"
                          onClick={() => revoke.mutate(k.id)}
                        >
                          Revoke
                        </Button>
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
            <DialogTitle>{rawKey ? "Key created" : "Create organization API key"}</DialogTitle>
            <DialogDescription>
              {rawKey ? "Store this key now — it won't be shown again." : "Pick a name and scopes."}
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
                <Label className="text-[11px]">Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. GitHub Actions — prod"
                  className="h-9 text-[13px]"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px]">Scopes</Label>
                <div className="grid grid-cols-2 gap-2">
                  {VALID_SCOPES.map((s) => (
                    <label key={s} className="flex items-center gap-2 text-[12px]">
                      <Checkbox
                        checked={scopes.includes(s)}
                        onCheckedChange={(checked) =>
                          setScopes((prev) =>
                            checked ? [...prev, s] : prev.filter((x) => x !== s),
                          )
                        }
                      />
                      <span className="font-mono">{s}</span>
                    </label>
                  ))}
                </div>
              </div>
              <DialogFooter>
                <Button
                  size="sm"
                  disabled={create.isPending || !name.trim() || scopes.length === 0}
                  onClick={() => create.mutate()}
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

/* ── Page ─────────────────────────────────────────────────────────── */

function IntegrationsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { organizationId, setOrganizationId, clearOrganization } = useOrganizationId();
  const search = Route.useSearch();

  useEffect(() => {
    if (search?.connected) {
      toast.success(
        `${
          search.connected === "github"
            ? "GitHub"
            : search.connected === "gitlab"
              ? "GitLab"
              : search.connected === "bitbucket"
                ? "Bitbucket"
                : "Integration"
        } connected`,
      );
    } else if (search?.error) {
      toast.error("Connection failed", { description: search.error });
    }
  }, [search?.connected, search?.error]);

  // The organization list is the source of truth. Org-scoped requests wait
  // for it, and the stored selection is re-validated every time it loads —
  // including right after the OAuth callback, so a stale ID from a previous
  // session can never be restored.
  const myOrgs = useMyOrganizations();
  const orgList = myOrgs.data;

  useEffect(() => {
    if (!orgList) return;
    if (orgList.length === 0) {
      if (organizationId !== null) clearOrganization();
      return;
    }
    if (organizationId === null || !orgList.some((o) => o.id === organizationId)) {
      setOrganizationId(orgList[0].id);
    }
  }, [orgList, organizationId, clearOrganization, setOrganizationId]);

  const activeOrganizationId =
    organizationId !== null && orgList?.some((o) => o.id === organizationId)
      ? organizationId
      : null;

  const integrationsQuery = useIntegrations(activeOrganizationId);

  // A 403 means the selection is no longer usable — drop it and reload the
  // list once instead of hammering the same forbidden URL.
  useEffect(() => {
    if (!integrationsQuery.error || !isForbidden(integrationsQuery.error)) return;
    toast.error("Organization no longer available", {
      description: "Reloading your organizations.",
    });
    clearOrganization();
    qc.removeQueries({ queryKey: ["integrations"] });
    qc.removeQueries({ queryKey: ["org-api-keys"] });
    qc.invalidateQueries({ queryKey: myOrganizationsQueryKey });
  }, [integrationsQuery.error, clearOrganization, qc]);

  const integrations = useMemo(
    () => (activeOrganizationId ? (integrationsQuery.data ?? []) : []),
    [activeOrganizationId, integrationsQuery.data],
  );

  const organizationId_ = activeOrganizationId;

  return (
    <>
      <PageHeader
        eyebrow="Workspace"
        title="Integrations & access"
        description="Connect source control and container registries, and manage who on your team can do what."
      />
      <div className="grid gap-5 lg:grid-cols-2">
        <OrganizationPanel
          organizationId={organizationId_}
          onSelect={setOrganizationId}
          onClear={clearOrganization}
        />

        {myOrgs.isLoading ? (
          <Panel title="Organization" className="lg:col-span-2">
            <TableSkeleton rows={2} cols={1} />
          </Panel>
        ) : organizationId_ ? (
          <>
            <MembersPanel organizationId={organizationId_} />

            <Panel
              title="Source control"
              description="Connect GitHub → OAuth → repository list → select repo → scan."
              className="lg:col-span-2"
            >
              {integrationsQuery.error ? (
                <ErrorState error={integrationsQuery.error} />
              ) : integrationsQuery.isLoading ? (
                <TableSkeleton rows={3} cols={1} />
              ) : (
                <Tabs defaultValue="github">
                  <TabsList>
                    <TabsTrigger value="github">
                      <Github className="h-3.5 w-3.5" /> GitHub
                    </TabsTrigger>
                    <TabsTrigger value="gitlab">
                      <GitBranch className="h-3.5 w-3.5" /> GitLab
                    </TabsTrigger>
                    <TabsTrigger value="bitbucket">
                      <GitFork className="h-3.5 w-3.5" /> Bitbucket
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="github" className="pt-4">
                    <SourceControlProvider
                      organizationId={organizationId_}
                      provider="github"
                      integrations={integrations}
                    />
                  </TabsContent>
                  <TabsContent value="gitlab" className="pt-4">
                    <SourceControlProvider
                      organizationId={organizationId_}
                      provider="gitlab"
                      integrations={integrations}
                    />
                  </TabsContent>
                  <TabsContent value="bitbucket" className="pt-4">
                    <SourceControlProvider
                      organizationId={organizationId_}
                      provider="bitbucket"
                      integrations={integrations}
                    />
                  </TabsContent>
                </Tabs>
              )}
            </Panel>

            <RegistriesPanel organizationId={organizationId_} integrations={integrations} />

            <OrgApiKeysPanel organizationId={organizationId_} />
          </>
        ) : (
          <Panel title="Get started" className="lg:col-span-2">
            <EmptyState
              icon={Building2}
              title="Create or select an organization above"
              description="Organizations scope every integration, role, and API key so nothing is tied to a single personal account."
            />
          </Panel>
        )}
      </div>
      {user && (
        <p className="mt-4 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Users className="h-3 w-3" /> Signed in as {user.email} — your user ID for member
          management is <span className="font-mono">{user.id}</span>.
        </p>
      )}
    </>
  );
}
