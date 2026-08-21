import { Toaster as Sonner } from "sonner";
import { CheckCircle2, AlertTriangle, XOctagon, Info, Loader2 } from "lucide-react";

type ToasterProps = React.ComponentProps<typeof Sonner>;

/**
 * Scan lifecycle toasts (started / complete / warning / timeout / failed) all
 * flow through sonner, so the whole product's notification surface is themed
 * here once with SecureFlow's dark tokens instead of sonner's light defaults.
 * Each intent gets its own accent border + icon colour so success, warning,
 * error and info stay distinguishable without relying on colour alone.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      icons={{
        success: <CheckCircle2 className="h-4 w-4 text-success" />,
        warning: <AlertTriangle className="h-4 w-4 text-warning" />,
        error: <XOctagon className="h-4 w-4 text-critical" />,
        info: <Info className="h-4 w-4 text-info" />,
        loading: <Loader2 className="h-4 w-4 animate-spin text-primary" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "group toast pointer-events-auto items-start gap-3 rounded-xl border border-border/70 bg-card/95 p-4 text-foreground shadow-[var(--shadow-glow),0_10px_40px_-12px_rgb(0_0_0/0.6)] backdrop-blur-xl",
          title: "font-display text-[13px] font-semibold leading-snug tracking-tight",
          description: "mt-0.5 text-[12px] leading-relaxed text-muted-foreground",
          icon: "mt-0.5",
          actionButton:
            "rounded-md bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground",
          cancelButton:
            "rounded-md bg-secondary px-2.5 py-1 text-[11px] font-medium text-muted-foreground",
          closeButton: "border-border/70 bg-secondary text-muted-foreground",
          success: "border-l-2 border-l-success",
          warning: "border-l-2 border-l-warning",
          error: "border-l-2 border-l-critical",
          info: "border-l-2 border-l-info",
          loading: "border-l-2 border-l-primary",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
