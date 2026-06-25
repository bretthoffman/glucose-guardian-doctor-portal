import type { ReactNode } from "react";
import { useDoctorSession } from "./mock-session";
import { OrgPicker } from "./screens/org-picker";
import { CredentialsStep } from "./screens/credentials-step";
import { ProfileSetup } from "./screens/profile-setup";
import { SetPinStep } from "./screens/set-pin-step";
import { PinLock } from "./screens/pin-lock";

/**
 * DEV-only controller for the redesigned first-run flow. Renders the right step, or the
 * authorized app (`children`) once the session is ready and unlocked. In production this is
 * replaced by Clerk + Convex; the individual step screens are reused there.
 */
export function MockAuthFlow({ children }: { children: ReactNode }) {
  const { step } = useDoctorSession();
  switch (step) {
    case "choose_org":
      return <OrgPicker />;
    case "authenticate":
      return <CredentialsStep />;
    case "complete_profile":
      return <ProfileSetup />;
    case "set_pin":
      return <SetPinStep />;
    case "locked":
      return <PinLock />;
    case "ready":
      return <>{children}</>;
  }
}
