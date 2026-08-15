import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AuthShell } from "@/components/site/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabaseClient";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set a new password — SecureFlow" },
      { name: "description", content: "Choose a new password for your SecureFlow account." },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState<"checking" | "valid" | "invalid">("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === "PASSWORD_RECOVERY" || session) setReady("valid");
    });

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setReady((prev) => (prev === "valid" ? prev : data.session ? "valid" : "invalid"));
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw new Error(updateError.message);
      await supabase.auth.signOut();
      toast.success("Password updated — sign in with your new password");
      navigate({ to: "/login" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update password");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Set a new password"
      subtitle="Choose a strong password you haven't used before."
      footer={
        <Link to="/login" className="text-foreground underline underline-offset-4">
          ← Back to sign in
        </Link>
      }
    >
      {ready === "checking" && (
        <p className="text-sm text-muted-foreground">Verifying your reset link…</p>
      )}

      {ready === "invalid" && (
        <div className="space-y-4">
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-muted-foreground">
            This reset link is invalid or has expired. Request a new one to continue.
          </div>
          <Link to="/forgot-password">
            <Button variant="hero" size="lg" className="w-full">
              Request a new reset link
            </Button>
          </Link>
        </div>
      )}

      {ready === "valid" && (
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              type="password"
              required
              autoComplete="new-password"
              placeholder="8+ characters"
              value={password}
              onChange={(e) => {
                setError(null);
                setPassword(e.target.value);
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Confirm password</Label>
            <Input
              id="confirm"
              type="password"
              required
              autoComplete="new-password"
              placeholder="Re-enter your password"
              value={confirm}
              onChange={(e) => {
                setError(null);
                setConfirm(e.target.value);
              }}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "password-error" : undefined}
            />
            {error && (
              <p id="password-error" className="text-xs text-destructive">
                {error}
              </p>
            )}
          </div>
          <Button type="submit" variant="hero" size="lg" className="w-full" disabled={submitting}>
            {submitting ? "Updating…" : "Update password"}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
