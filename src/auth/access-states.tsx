import type { ComponentType, ReactNode } from "react";
import { useUser, useClerk } from "@clerk/clerk-react";
import { ShieldAlert, Clock, Ban, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

type Tone = "muted" | "warning" | "danger";

const TONE_CLASSES: Record<Tone, string> = {
  muted: "bg-primary/10 border-primary/30 text-primary",
  warning: "bg-amber-500/10 border-amber-500/30 text-amber-600",
  danger: "bg-destructive/10 border-destructive/30 text-destructive",
};

function StateCard({
  icon: Icon,
  tone,
  title,
  body,
}: {
  icon: ComponentType<{ className?: string }>;
  tone: Tone;
  title: string;
  body: ReactNode;
}) {
  const { user } = useUser();
  const { signOut } = useClerk();
  const email = user?.primaryEmailAddress?.emailAddress;

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md text-center bg-card border border-border rounded-2xl p-8 sm:p-10 shadow-xl">
        <div
          className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 border ${TONE_CLASSES[tone]}`}
        >
          <Icon className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-3">{title}</h1>
        <div className="text-muted-foreground text-sm leading-relaxed space-y-3">{body}</div>
        {email && (
          <p className="text-xs text-muted-foreground mt-6">
            Signed in as <span className="font-medium text-foreground">{email}</span>
          </p>
        )}
        <Button variant="outline" className="mt-4" onClick={() => signOut()}>
          <LogOut className="w-4 h-4 mr-2" /> Sign out
        </Button>
      </div>
    </div>
  );
}

export function NotProvisionedScreen() {
  return (
    <StateCard
      icon={ShieldAlert}
      tone="muted"
      title="Access not provisioned"
      body={
        <>
          <p>Your sign-in worked, but this account isn't linked to a doctor profile yet.</p>
          <p>
            Doctor access is granted by invitation from your organization's administrator — it
            can't be self-created.
          </p>
        </>
      }
    />
  );
}

export function PendingScreen() {
  return (
    <StateCard
      icon={Clock}
      tone="warning"
      title="Account pending"
      body={
        <p>
          Your doctor profile is awaiting activation by your organization. You'll have access once
          it's approved.
        </p>
      }
    />
  );
}

export function SuspendedScreen() {
  return (
    <StateCard
      icon={Ban}
      tone="danger"
      title="Access suspended"
      body={
        <p>
          Your doctor access has been suspended. Contact your organization's administrator to
          restore it.
        </p>
      }
    />
  );
}
