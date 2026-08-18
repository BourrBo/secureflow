import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { projectsQuery } from "@/lib/queries";
import {
  Shield,
  LayoutDashboard,
  Code2,
  Package,
  KeyRound,
  Boxes,
  Container,
  Radar,
  Bug,
  FolderGit2,
  FileText,
  GitBranch,
  ScrollText,
  Plug,
  Settings,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

const overview = [{ title: "Overview", url: "/dashboard", icon: LayoutDashboard }];

const scanners = [
  { title: "SAST", url: "/dashboard/sast", icon: Code2 },
  { title: "SCA", url: "/dashboard/sca", icon: Package },
  { title: "Secrets", url: "/dashboard/secrets", icon: KeyRound },
  { title: "IaC", url: "/dashboard/iac", icon: Boxes },
  { title: "Container", url: "/dashboard/container", icon: Container },
  { title: "DAST", url: "/dashboard/dast", icon: Radar },
];

const workspace = [
  { title: "Findings", url: "/dashboard/findings", icon: Bug },
  { title: "Projects", url: "/dashboard/projects", icon: FolderGit2 },
  { title: "Reports", url: "/dashboard/reports", icon: FileText },
  { title: "Pipeline", url: "/dashboard/pipeline", icon: GitBranch },
  { title: "Compliance", url: "/dashboard/compliance", icon: ScrollText },
  { title: "Integrations", url: "/dashboard/integrations", icon: Plug },
  { title: "Settings", url: "/dashboard/settings", icon: Settings },
];

function Section({
  label,
  items,
  currentPath,
}: {
  label: string;
  items: typeof scanners;
  currentPath: string;
}) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel className="px-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground/70">
        {label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const active = currentPath === item.url;
            return (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton
                  asChild
                  isActive={active}
                  className="h-8 text-[13px] data-[active=true]:bg-primary/10 data-[active=true]:font-medium data-[active=true]:text-primary data-[active=true]:shadow-[inset_2px_0_0_0_var(--primary)]"
                >
                  <Link to={item.url}>
                    <item.icon />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function AppSidebar() {
  const currentPath = useRouterState({ select: (r) => r.location.pathname });
  const { state } = useSidebar();
  const projects = useQuery(projectsQuery());
  const collapsed = state === "collapsed";
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <Link to="/" className="flex items-center gap-2 px-2 py-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[image:var(--gradient-primary)] shadow-[var(--shadow-glow)]">
            <Shield className="h-4 w-4 text-primary-foreground" />
          </span>
          {!collapsed && (
            <span className="font-display text-base font-bold tracking-tight">SecureFlow</span>
          )}
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <Section label="Overview" items={overview} currentPath={currentPath} />
        <Section label="Modules" items={scanners} currentPath={currentPath} />
        <Section label="Workspace" items={workspace} currentPath={currentPath} />
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        {!collapsed && (
          <div className="rounded-lg bg-primary/10 p-3 text-xs">
            <div className="font-semibold text-foreground">Connected repositories</div>
            <div className="mt-1 font-mono tabular-nums text-muted-foreground">
              {projects.isLoading
                ? "…"
                : projects.error
                  ? "unavailable"
                  : `${projects.data?.length ?? 0} connected`}
            </div>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
