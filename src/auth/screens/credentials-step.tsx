import { useState } from "react";
import { ArrowRight, Building2, Eye, EyeOff, ShieldAlert } from "lucide-react";
import { useDoctorAuthLogin, useDoctorAuthRegister } from "@doctor-portal/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDoctorSession } from "../mock-session";
import { hashPassword } from "../password";
import { AuthShell } from "./auth-shell";

const NO_TITLE = "none";
// Honorific shown to patients as "<title> <last name>" on treatment proposals (e.g. "Dr. Rivera").
const TITLE_OPTIONS = ["Dr.", "NP", "PA", "RN", "PharmD"] as const;

/**
 * Email + password form for both entry points. `mode` is controlled by the auth flow:
 * "signin" is the front door; "create" is reached only after picking an organization.
 */
export function CredentialsStep({
  mode,
  onCreateAccount,
  onSignIn,
  onChangeOrg,
}: {
  mode: "create" | "signin";
  /** Sign-in mode: user wants to create an account (routes to the org picker). */
  onCreateAccount?: () => void;
  /** Create mode: user already has an account (back to sign-in). */
  onSignIn?: () => void;
  /** Create mode: user wants to pick a different organization. */
  onChangeOrg?: () => void;
}) {
  const { org, actions } = useDoctorSession();
  const register = useDoctorAuthRegister();
  const login = useDoctorAuthLogin();
  const [title, setTitle] = useState("Dr.");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const at = email.trim().toLowerCase();
    if (!at || !at.includes("@")) {
      setErr("Enter your work email.");
      return;
    }
    if (password.length < 6) {
      setErr("Password must be at least 6 characters.");
      return;
    }
    if (mode === "create") {
      if (!firstName.trim() || !lastName.trim()) {
        setErr("Enter your first and last name.");
        return;
      }
      if (password !== confirm) {
        setErr("Passwords don't match.");
        return;
      }
    }

    const passwordHash = hashPassword(password);
    // "No title" sends an empty title; the server then falls back to the full name for the byline.
    const titleOut = title === NO_TITLE ? "" : title.trim();
    const first = firstName.trim();
    const last = lastName.trim();
    const displayName = [titleOut, first, last].filter(Boolean).join(" ");
    setSubmitting(true);
    try {
      if (mode === "create") {
        await register.mutateAsync({
          data: {
            email: at,
            passwordHash,
            displayName,
            title: titleOut || undefined,
            firstName: first,
            lastName: last,
            institution: org?.name,
          },
        });
        // Brand-new account: queue the one-time guided tour (sign-ins never auto-run it).
        try {
          sessionStorage.setItem("gg_tour_pending", "1");
        } catch {
          /* ignore */
        }
      }
      const res = await login.mutateAsync({ data: { email: at, passwordHash } });
      actions.authenticate(res.doctor, res.token, res.expiresAt);
    } catch {
      setErr(
        mode === "create"
          ? "Couldn't create your account — that email may already be registered."
          : "Invalid email or password.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const busy = submitting || register.isPending || login.isPending;

  return (
    <AuthShell
      title={mode === "create" ? "Create your account" : "Sign in"}
      subtitle={
        mode === "create"
          ? org
            ? `${org.name} · work email`
            : undefined
          : "Welcome back — use your work email."
      }
    >
      <form onSubmit={submit} className="space-y-4">
        {mode === "create" && (
          <div className="grid grid-cols-[5.5rem_1fr] gap-3">
            <div>
              <Label htmlFor="title">Title</Label>
              <Select value={title} onValueChange={setTitle}>
                <SelectTrigger id="title" className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TITLE_OPTIONS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                  <SelectItem value={NO_TITLE}>No title</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="firstName">First name</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Alex"
                  className="mt-1.5"
                  autoComplete="given-name"
                />
              </div>
              <div>
                <Label htmlFor="lastName">Last name</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Rivera"
                  className="mt-1.5"
                  autoComplete="family-name"
                />
              </div>
            </div>
          </div>
        )}

        {mode === "create" && lastName.trim() && (
          <p className="-mt-1 text-xs text-muted-foreground">
            Patients will see{" "}
            <span className="font-medium text-foreground">
              {[title === NO_TITLE ? "" : title, lastName.trim()].filter(Boolean).join(" ")}
            </span>{" "}
            on treatment changes.
          </p>
        )}

        <div>
          <Label htmlFor="email">Work email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@hospital.org"
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

        <Button type="submit" className="w-full h-12" disabled={busy}>
          {busy ? "Please wait…" : mode === "create" ? "Create account" : "Sign in"}
          {!busy && <ArrowRight className="w-4 h-4 ml-2" />}
        </Button>
      </form>

      <div className="mt-4 flex items-center justify-between text-sm">
        {mode === "create" ? (
          <>
            <button
              onClick={() => {
                setErr(null);
                onSignIn?.();
              }}
              className="text-primary hover:underline"
            >
              Already have an account? Sign in
            </button>
            <button
              onClick={() => onChangeOrg?.()}
              className="text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <Building2 className="w-3.5 h-3.5" /> Change org
            </button>
          </>
        ) : (
          <button
            onClick={() => {
              setErr(null);
              onCreateAccount?.();
            }}
            className="text-primary hover:underline"
          >
            New here? Create an account
          </button>
        )}
      </div>
    </AuthShell>
  );
}
