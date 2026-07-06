import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthShell } from "@/components/site/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Github } from "lucide-react";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in — SecureFlow" }, { name: "description", content: "Sign in to SecureFlow to run unified security scans across your codebase." }] }),
  component: LoginPage,
});

function LoginPage() {
  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to your SecureFlow workspace."
      footer={<>New here? <Link to="/signup" className="text-foreground underline underline-offset-4">Create an account</Link></>}
    >
      <div className="space-y-3">
        <Button variant="outline" className="w-full"><Github className="h-4 w-4" /> Continue with GitHub</Button>
        <Button variant="outline" className="w-full">Continue with Google</Button>
      </div>
      <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
        <div className="h-px flex-1 bg-border" /> OR <div className="h-px flex-1 bg-border" />
      </div>
      <form className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Work email</Label>
          <Input id="email" type="email" placeholder="you@company.com" />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link to="/forgot-password" className="text-xs text-muted-foreground hover:text-foreground">Forgot?</Link>
          </div>
          <Input id="password" type="password" placeholder="••••••••" />
        </div>
        <Button asChild variant="hero" size="lg" className="w-full"><Link to="/dashboard">Sign in</Link></Button>
      </form>
    </AuthShell>
  );
}