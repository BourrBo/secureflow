import { createFileRoute, Link } from "@tanstack/react-router";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { AuthShell } from "@/components/site/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Github } from "lucide-react";
import { GoogleButton } from "@/components/site/GoogleButton";
import { useAuth } from "@/lib/auth";
import { BUSINESS_EMAIL_FIELD_ERROR, isBusinessEmail } from "@/lib/businessEmail";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Start free — SecureFlow" },
      {
        name: "description",
        content: "Create your SecureFlow workspace and scan your first repo in minutes.",
      },
    ],
  }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const { signUp, signInWithOAuth } = useAuth();
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", password: "" });
  const [submitting, setSubmitting] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  const update = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => {
      if (k === "email") setEmailError(null);
      return { ...f, [k]: e.target.value };
    });

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isBusinessEmail(form.email)) {
      setEmailError(BUSINESS_EMAIL_FIELD_ERROR);
      return;
    }
    if (form.password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setSubmitting(true);
    try {
      await signUp(form);
      toast.success("Workspace created — welcome to SecureFlow");
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign up failed");
    } finally {
      setSubmitting(false);
    }
  };

  const onGoogle = useCallback(async () => {
    try {
      await signInWithOAuth("google");
      toast.success("Account ready");
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Google sign-up failed");
    }
  }, [navigate, signInWithOAuth]);

  const onGitHub = useCallback(async () => {
    try {
      await signInWithOAuth("github");
      toast.success("Account ready");
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "GitHub sign-up failed");
    }
  }, [navigate, signInWithOAuth]);

  return (
    <AuthShell
      title="Start scanning free"
      subtitle="No credit card. Free forever tier. Set up in 2 minutes."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="text-foreground underline underline-offset-4">
            Sign in
          </Link>
        </>
      }
    >
      <GoogleButton onClick={onGoogle} text="signup_with" />
      <Button variant="secondary" size="lg" className="mt-3 w-full" onClick={onGitHub}>
        <Github className="mr-2 h-5 w-5" />
        Sign up with GitHub
      </Button>
      <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
        <div className="h-px flex-1 bg-border" /> OR <div className="h-px flex-1 bg-border" />
      </div>
      <form className="space-y-4" onSubmit={onSubmit}>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="fn">First name</Label>
            <Input
              id="fn"
              autoComplete="given-name"
              placeholder="Ada"
              value={form.first_name}
              onChange={update("first_name")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ln">Last name</Label>
            <Input
              id="ln"
              autoComplete="family-name"
              placeholder="Lovelace"
              value={form.last_name}
              onChange={update("last_name")}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Work email</Label>
          <Input
            id="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@company.com"
            value={form.email}
            onChange={update("email")}
            aria-invalid={emailError ? true : undefined}
            aria-describedby={emailError ? "email-error" : undefined}
          />
          {emailError && (
            <p id="email-error" className="text-xs text-destructive">
              {emailError}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            required
            autoComplete="new-password"
            placeholder="8+ characters"
            value={form.password}
            onChange={update("password")}
          />
        </div>
        <Button type="submit" variant="hero" size="lg" className="w-full" disabled={submitting}>
          {submitting ? "Creating…" : "Create workspace"}
        </Button>
        <ul className="space-y-1.5 pt-2 text-xs text-muted-foreground">
          {[
            "3 repositories free forever",
            "SAST + Secrets scanners included",
            "Upgrade anytime",
          ].map((f) => (
            <li key={f} className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-success" />
              {f}
            </li>
          ))}
        </ul>
      </form>
    </AuthShell>
  );
}
