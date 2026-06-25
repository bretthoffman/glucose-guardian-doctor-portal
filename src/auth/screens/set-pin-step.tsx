import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDoctorSession } from "../mock-session";
import { AuthShell } from "./auth-shell";

const clean = (v: string) => v.replace(/\D/g, "").slice(0, 4);

export function SetPinStep() {
  const { actions } = useDoctorSession();
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pin.length !== 4) {
      setErr("PIN must be 4 digits.");
      return;
    }
    if (pin !== confirm) {
      setErr("PINs don't match.");
      return;
    }
    actions.setPin(pin);
  }

  return (
    <AuthShell title="Set a quick-access PIN" subtitle="Optional — for this device only.">
      <form onSubmit={submit} className="space-y-4">
        <div className="rounded-xl border border-border bg-secondary/30 p-3 flex items-start gap-2">
          <ShieldCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            The PIN unlocks this device after a short idle. It never replaces full sign-in — after
            you sign out you'll log in with your work email again.
          </p>
        </div>
        <div>
          <Label htmlFor="pin">4-digit PIN</Label>
          <Input
            id="pin"
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPin(clean(e.target.value))}
            className="mt-1.5 text-center tracking-[0.5em] text-lg"
            placeholder="••••"
          />
        </div>
        <div>
          <Label htmlFor="confirm">Confirm PIN</Label>
          <Input
            id="confirm"
            inputMode="numeric"
            value={confirm}
            onChange={(e) => setConfirm(clean(e.target.value))}
            className="mt-1.5 text-center tracking-[0.5em] text-lg"
            placeholder="••••"
          />
        </div>
        {err && <p className="text-sm text-destructive">{err}</p>}
        <Button type="submit" className="w-full h-12">
          Set PIN
        </Button>
      </form>
      <div className="mt-4 flex flex-col gap-2 text-center text-sm">
        <button
          onClick={() => actions.skipPin(false)}
          className="text-muted-foreground hover:text-foreground"
        >
          Skip — ask me later
        </button>
        <button
          onClick={() => actions.skipPin(true)}
          className="text-muted-foreground hover:text-foreground"
        >
          This is a shared device — don't offer a PIN
        </button>
      </div>
    </AuthShell>
  );
}
