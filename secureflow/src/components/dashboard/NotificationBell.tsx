import { Bell, CheckCircle2, Info, XCircle, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useNotifications, type NotificationKind } from "@/lib/notifications";
import { useRunningScans } from "@/lib/moduleScan";
import { useDastScan } from "@/lib/dastScan";
import { MODULE_LABEL, relativeTime, type ModuleKey } from "@/lib/security";

const ICON: Record<NotificationKind, typeof Info> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
};

const TONE: Record<NotificationKind, string> = {
  success: "text-emerald-400",
  error: "text-destructive",
  info: "text-muted-foreground",
};

/**
 * Real events only: scans started/completed/failed in this session (recorded
 * by ModuleScanProvider and DastScanProvider) plus any scan currently running.
 * Nothing is fabricated — with no events the popover shows an empty state.
 */
export function NotificationBell() {
  const { notifications, unreadCount, markAllRead, dismiss, clear } = useNotifications();
  const running = useRunningScans();
  const dast = useDastScan();

  const active: Array<{ key: string; label: string; detail: string }> = Object.entries(running).map(
    ([m, r]) => ({
      key: m,
      label: `${MODULE_LABEL[m as ModuleKey]} scan running`,
      detail: r!.label,
    }),
  );
  if (dast.state.status === "running") {
    active.push({
      key: "dast",
      label: "DAST scan running",
      detail: [
        dast.state.targetUrl,
        dast.state.phase,
        dast.state.pct !== null ? `${dast.state.pct}%` : null,
      ]
        .filter(Boolean)
        .join(" · "),
    });
  }

  return (
    <Popover onOpenChange={(open) => open && markAllRead()}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Open notifications" className="relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 font-mono text-[9px] text-primary-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
          <h4 className="text-[13px] font-medium">Notifications</h4>
          {notifications.length > 0 && (
            <button
              onClick={clear}
              className="text-[11px] text-muted-foreground transition-colors hover:text-foreground"
            >
              Clear all
            </button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {active.map((a) => (
            <div key={a.key} className="flex gap-2 border-b border-border/40 px-3 py-2">
              <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-primary" />
              <div className="min-w-0">
                <div className="truncate text-[12px] font-medium">{a.label}</div>
                <div className="truncate text-[11px] text-muted-foreground">{a.detail}</div>
              </div>
            </div>
          ))}
          {notifications.map((n) => {
            const Icon = ICON[n.kind];
            return (
              <div key={n.id} className="group flex gap-2 border-b border-border/40 px-3 py-2">
                <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${TONE[n.kind]}`} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px] font-medium">{n.title}</div>
                  {n.description && (
                    <div className="truncate text-[11px] text-muted-foreground">
                      {n.description}
                    </div>
                  )}
                  <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                    {relativeTime(new Date(n.at))}
                  </div>
                </div>
                <button
                  aria-label="Dismiss notification"
                  onClick={() => dismiss(n.id)}
                  className="opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <X className="h-3 w-3 text-muted-foreground" />
                </button>
              </div>
            );
          })}
          {active.length === 0 && notifications.length === 0 && (
            <div className="space-y-1 px-3 py-4">
              <p className="text-[11px] text-muted-foreground">No notifications yet</p>
              <p className="text-[11px] text-muted-foreground">
                You'll see scan completions and alerts here.
              </p>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
