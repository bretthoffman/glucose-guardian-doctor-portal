import { useState } from "react";
import { ArrowRight, Building2, Eye, EyeOff, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { mockOrganizations } from "@/data/mock";
import { useDoctorSession } from "../mock-session";
import { AuthShell } from "./auth-shell";

export function CredentialsStep() {
  const { org, actions } = useDoctorSession();
  const full = mockOrganizations().find((o) => o.id === org?.id);
  const domains = full?.allowedDomains ?? [];
  const [mode, setMode] = useState<"create" | "signin">("create");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const at = email.trim().toLowerCase();
    const domainOk = domains.some((d) => at.endsWith(`@${d}`));
    if (!at || !domainOk) {
      setErr(
        `Use your ${org?.name ?? "organization"} work email (e.g. name@${domains[0] ?? "org.org"}).`,
      );
      return;
    }
    if (password.length < 6) {
      setErr("Enter a password (6+ characters).");
      return;
    }
    if (mode === "create" && password !== confirm) {
      setErr("Passwords don't match.");
      return;
    }
    actions.authenticate(at);
  }

  return (
    <AuthShell
      title={mode === "create" ? "Create your account" : "Sign in"}
      subtitle={org ? `${org.name} · work email required` : undefined}
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label htmlFor="email">Work email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={`name@${domains[0] ?? "org.org"}`}
            className="mt-1.5"
            autoComplete="email"
          />
        </div>

        <div>
          <Label htmlFor="password">Password</Label>
          <div className="relative mt-1.5">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pr-10"
              autoComplete={mode === "create" ? "new-password" : "current-password"}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {mode === "create" && (
          <div>
            <Label htmlFor="confirm">Confirm password</Label>
            <div className="relative mt-1.5">
              <Input
                id="confirm"
                type={showPassword ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="pr-10"
                autoComplete="new-password"
              />
            </div>
          </div>
        )}

        {err && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-3 flex items-start gap-2">
            <ShieldAlert className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <p className="text-sm text-destructive">{err}</p>
          </div>
        )}

        <Button type="submit" className="w-full h-12">
          {mode === "create" ? "Create account" : "Sign in"}
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </form>

      <div className="mt-4 flex items-center justify-between text-sm">
        <button
          onClick={() => {
            setErr(null);
            setMode(mode === "create" ? "signin" : "create");
          }}
          className="text-primary hover:underline"
        >
          {mode === "create" ? "Already have an account? Sign in" : "Create an account"}
        </button>
        <button
          onClick={() => actions.resetOrg()}
          className="text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          <Building2 className="w-3.5 h-3.5" /> Change org
        </button>
      </div>

      <p className="text-xs text-muted-foreground mt-4 text-center">
        In production this is Clerk (work email + MFA). The mock skips real verification.
      </p>
    </AuthShell>
  );
}
