import type { ReactNode } from "react";
import { useDoctorSession } from "./mock-session";
import { OrgPicker } from "./screens/org-picker";
import { CredentialsStep } from "./screens/credentials-step";
import { SetPinStep } from "./screens/set-pin-step";
import { PinLock } from "./screens/pin-lock";

/**
 * Controller for the doctor sign-in flow: organization → real account sign-in → optional PIN
 * lock, then the authorized app (`children`).
 */
export function MockAuthFlow({ children }: { children: ReactNode }) {
  const { step } = useDoctorSession();
  switch (step) {
    case "choose_org":
      return <OrgPicker />;
    case "authenticate":
      return <CredentialsStep />;
    case "set_pin":
      return <SetPinStep />;
    case "locked":
      return <PinLock />;
    case "ready":
      return <>{children}</>;
  }
}
