import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/dashboard/AppSidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Bell, Search, Play, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { ScanResultsProvider } from "@/lib/scanResults";
import { DastScanProvider } from "@/lib/dastScan";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [{ title: "Dashboard — SecureFlow" }, { name: "robots", content: "noindex" }],
  }),
  component: DashboardLayout,
});

function DashboardLayout() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [searchValue, setSearchValue] = useState("");

  useEffect(() => {
    setSearchValue("");
  }, [pathname]);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  if (loading || !user) {
    return (
      <div className="min-h-screen space-y-4 bg-background p-8">
        <div className="h-8 w-56 animate-pulse rounded-md bg-secondary" />
        <div className="grid gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-secondary" />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-xl bg-secondary" />
      </div>
    );
  }

  const initials =
    `${user.first_name?.[0] ?? user.email[0]}${user.last_name?.[0] ?? ""}`.toUpperCase();

  return (
    <ScanResultsProvider>
      <DastScanProvider>
        <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border/60 bg-background/80 px-4 backdrop-blur-xl">
            <SidebarTrigger />
            {pathname !== "/dashboard/" && (
              <div className="relative hidden max-w-md flex-1 md:block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && searchValue.trim()) {
                      navigate({
                        to: "/dashboard/findings",
                        search: { q: searchValue.trim() },
                      });
                    }
                  }}
                  placeholder="Search findings, projects, CVEs…"
                  className="h-9 pl-9 text-[13px]"
                />
              </div>
            )}
            <div className="ml-auto flex items-center gap-2">
              <Button variant="hero" size="sm" asChild>
                <Link to="/dashboard/sast">
                  <Play className="h-3.5 w-3.5" /> Run scan
                </Link>
              </Button>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Open notifications">
                    <Bell className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-72">
                  <div className="space-y-1">
                    <h4 className="font-medium text-[13px]">Notifications</h4>
                    <p className="text-[11px] text-muted-foreground">No notifications yet</p>
                    <p className="text-[11px] text-muted-foreground">
                      You'll see scan completions and alerts here.
                    </p>
                  </div>
                </PopoverContent>
              </Popover>
              {user.avatar_url ? (
                <img src={user.avatar_url} alt={user.email} className="h-8 w-8 rounded-full" />
              ) : (
                <div className="grid h-8 w-8 place-items-center rounded-full bg-[image:var(--gradient-primary)] text-xs font-semibold text-primary-foreground">
                  {initials}
                </div>
              )}
              <div className="mr-1 hidden min-w-0 leading-tight md:block">
                <div className="truncate text-[12px] font-medium">
                  {[user.first_name, user.last_name].filter(Boolean).join(" ") || user.email}
                </div>
                <div className="truncate text-[10px] text-muted-foreground">{user.email}</div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  signOut();
                  navigate({ to: "/" });
                }}
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </header>
          <main className="flex-1 p-6 md:p-8">
            <Outlet />
          </main>
        </div>
      </div>
      </SidebarProvider>
    </DastScanProvider>
    </ScanResultsProvider>
  );
}
