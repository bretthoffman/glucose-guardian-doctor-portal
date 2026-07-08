import { useEffect, useState, type ReactNode } from "react";
import { useDoctorSession } from "./mock-session";
import { OrgPicker } from "./screens/org-picker";
import { CredentialsStep } from "./screens/credentials-step";
import { SetPinStep } from "./screens/set-pin-step";
import { PinLock } from "./screens/pin-lock";

/**
 * Controller for the doctor auth flow. Sign-in is the front door; "Create an account" first
 * routes through the organization picker, then the account form:
 *
 *   Sign in ──"Create an account"──► Find your organization ──pick──► Create account form
 *      ▲                                   │  back                        │  "Sign in" link
 *      └───────────────────────────────────┴───────────────────────────────┘
 *
 * After authentication: optional device PIN, then the authorized app (`children`).
 */
export function MockAuthFlow({ children }: { children: ReactNode }) {
  const { step } = useDoctorSession();
  const [signup, setSignup] = useState<"none" | "org" | "form">("none");

  // Leaving the authenticate step (successful sign-in/up, or sign-out later) resets the sub-flow.
  useEffect(() => {
    if (step !== "authenticate") setSignup("none");
  }, [step]);

  switch (step) {
    case "authenticate":
      if (signup === "org") {
        return <OrgPicker onPicked={() => setSignup("form")} onBack={() => setSignup("none")} />;
      }
      if (signup === "form") {
        return (
          <CredentialsStep
            mode="create"
            onSignIn={() => setSignup("none")}
            onChangeOrg={() => setSignup("org")}
          />
        );
      }
      return <CredentialsStep mode="signin" onCreateAccount={() => setSignup("org")} />;
    case "set_pin":
      return <SetPinStep />;
    case "locked":
      return <PinLock />;
    case "ready":
      return <>{children}</>;
  }
}
