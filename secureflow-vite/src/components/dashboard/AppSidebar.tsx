import { Link, useRouterState } from "@tanstack/react-router";
import {
  Shield, LayoutDashboard, Code2, Package, KeyRound, Boxes, Container, Radar,
  Bug, FolderGit2, FileText, ScrollText, Settings,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar,
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
  { title: "Compliance", url: "/dashboard/compliance", icon: ScrollText },
  { title: "Settings", url: "/dashboard/settings", icon: Settings },
];

function Section({ label, items, currentPath }: { label: string; items: typeof scanners; currentPath: string }) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const active = currentPath === item.url;
            return (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton asChild isActive={active} className="data-[active=true]:bg-primary/10 data-[active=true]:text-primary">
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
  const collapsed = state === "collapsed";
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <Link to="/" className="flex items-center gap-2 px-2 py-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[image:var(--gradient-primary)] shadow-[var(--shadow-glow)]">
            <Shield className="h-4 w-4 text-primary-foreground" />
          </span>
          {!collapsed && <span className="font-display text-base font-bold tracking-tight">SecureFlow</span>}
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <Section label="Overview" items={overview} currentPath={currentPath} />
        <Section label="Scanners" items={scanners} currentPath={currentPath} />
        <Section label="Workspace" items={workspace} currentPath={currentPath} />
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        {!collapsed && (
          <div className="rounded-lg bg-primary/10 p-3 text-xs">
            <div className="font-semibold text-foreground">Free plan</div>
            <div className="mt-1 text-muted-foreground">2 of 3 repos used</div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-sidebar-border">
              <div className="h-full w-2/3 rounded-full bg-[image:var(--gradient-primary)]" />
            </div>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}