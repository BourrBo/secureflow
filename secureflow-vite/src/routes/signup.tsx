import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthShell } from "@/components/site/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Github, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "Start free — SecureFlow" }, { name: "description", content: "Create your SecureFlow workspace and scan your first repo in minutes." }] }),
  component: SignupPage,
});

function SignupPage() {
  return (
    <AuthShell
      title="Start scanning free"
      subtitle="No credit card. Free forever tier. Set up in 2 minutes."
      footer={<>Already have an account? <Link to="/login" className="text-foreground underline underline-offset-4">Sign in</Link></>}
    >
      <div className="space-y-3">
        <Button variant="outline" className="w-full"><Github className="h-4 w-4" /> Continue with GitHub</Button>
        <Button variant="outline" className="w-full">Continue with Google</Button>
      </div>
      <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
        <div className="h-px flex-1 bg-border" /> OR <div className="h-px flex-1 bg-border" />
      </div>
      <form className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2"><Label htmlFor="fn">First name</Label><Input id="fn" placeholder="Ada" /></div>
          <div className="space-y-2"><Label htmlFor="ln">Last name</Label><Input id="ln" placeholder="Lovelace" /></div>
        </div>
        <div className="space-y-2"><Label htmlFor="email">Work email</Label><Input id="email" type="email" placeholder="you@company.com" /></div>
        <div className="space-y-2"><Label htmlFor="password">Password</Label><Input id="password" type="password" placeholder="8+ characters" /></div>
        <Button asChild variant="hero" size="lg" className="w-full"><Link to="/dashboard">Create workspace</Link></Button>
        <ul className="space-y-1.5 pt-2 text-xs text-muted-foreground">
          {["3 repositories free forever", "SAST + Secrets scanners included", "Upgrade anytime"].map((f) => (
            <li key={f} className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-success" />{f}</li>
          ))}
        </ul>
      </form>
    </AuthShell>
  );
}