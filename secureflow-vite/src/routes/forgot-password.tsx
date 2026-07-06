import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthShell } from "@/components/site/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({ meta: [{ title: "Reset password — SecureFlow" }, { name: "description", content: "Reset your SecureFlow account password." }] }),
  component: ForgotPage,
});

function ForgotPage() {
  return (
    <AuthShell
      title="Reset your password"
      subtitle="We'll email you a secure link to set a new one."
      footer={<Link to="/login" className="text-foreground underline underline-offset-4">← Back to sign in</Link>}
    >
      <form className="space-y-4">
        <div className="space-y-2"><Label htmlFor="email">Work email</Label><Input id="email" type="email" placeholder="you@company.com" /></div>
        <Button variant="hero" size="lg" className="w-full">Send reset link</Button>
      </form>
    </AuthShell>
  );
}