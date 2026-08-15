import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/dashboard/AppSidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Play, LogOut, Search } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { ScanResultsProvider } from "@/lib/scanResults";
import { DastScanProvider } from "@/lib/dastScan";
import { NotificationsProvider } from "@/lib/notifications";
import { ModuleScanProvider } from "@/lib/moduleScan";
import { NotificationBell } from "@/components/dashboard/NotificationBell";

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
  const [term, setTerm] = useState("");
  const showSearch = pathname === "/dashboard" || pathname === "/dashboard/";

  useEffect(() => {
    setTerm("");
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
    <NotificationsProvider>
      <ScanResultsProvider>
        <ModuleScanProvider>
          <DastScanProvider>
            <SidebarProvider>
              <div className="flex min-h-screen w-full bg-background">
                <AppSidebar />
                <div className="flex min-w-0 flex-1 flex-col">
                  <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border/60 bg-background/80 px-4 backdrop-blur-xl">
                    <SidebarTrigger />
                    {showSearch && (
                      <form
                        className="flex min-w-0 items-center gap-2"
                        onSubmit={(e) => {
                          e.preventDefault();
                          navigate({ to: "/dashboard/findings", search: { q: term.trim() } });
                        }}
                      >
                        <Input
                          value={term}
                          onChange={(e) => setTerm(e.target.value)}
                          placeholder="Search findings…"
                          aria-label="Search findings"
                          className="h-8 w-[180px] text-[12px] sm:w-[260px]"
                        />
                        <Button type="submit" variant="outline" size="icon" aria-label="Search">
                          <Search className="h-3.5 w-3.5" />
                        </Button>
                      </form>
                    )}
                    <div className="ml-auto flex items-center gap-2">
                      <Button variant="hero" size="sm" asChild>
                        <Link to="/dashboard/sast">
                          <Play className="h-3.5 w-3.5" /> Run scan
                        </Link>
                      </Button>
                      <NotificationBell />
                      {user.avatar_url ? (
                        <img
                          src={user.avatar_url}
                          alt={user.email}
                          className="h-8 w-8 rounded-full"
                        />
                      ) : (
                        <div className="grid h-8 w-8 place-items-center rounded-full bg-[image:var(--gradient-primary)] text-xs font-semibold text-primary-foreground">
                          {initials}
                        </div>
                      )}
                      <div className="mr-1 hidden min-w-0 leading-tight md:block">
                        <div className="truncate text-[12px] font-medium">
                          {[user.first_name, user.last_name].filter(Boolean).join(" ") ||
                            user.email}
                        </div>
                        <div className="truncate text-[10px] text-muted-foreground">
                          {user.email}
                        </div>
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
        </ModuleScanProvider>
      </ScanResultsProvider>
    </NotificationsProvider>
  );
}
