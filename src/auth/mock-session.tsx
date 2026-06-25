import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Organization } from "./use-current-doctor";
import { mockOrganizations } from "@/data/mock";

/**
 * DEV-ONLY mock of the doctor session/onboarding flow, so the redesigned first-run
 * experience (choose org → work-email sign-in → profile → optional PIN → lock) can be built
 * and demoed without Clerk or the backend.
 *
 * In production this whole layer is replaced by Clerk (identity, sessions, MFA, passkeys) +
 * Convex (org membership, profile, provisioning) + a device-bound PIN lock. The PIN here is a
 * convenience lock over a live session — never primary auth — matching the agreed model.
 */

export type SessionStep =
  | "choose_org"
  | "authenticate"
  | "complete_profile"
  | "set_pin"
  | "locked"
  | "ready";

export interface DoctorOnboardingProfile {
  fullName: string;
  title: string;
  specialty: string;
  npi?: string;
}

interface SessionState {
  orgId?: string;
  signedIn: boolean;
  email?: string;
  profile?: DoctorOnboardingProfile;
  pinHash?: string;
  pinSkipped: boolean;
  sharedDevice: boolean;
  locked: boolean;
  attempts: number;
}

export interface SessionActions {
  chooseOrg: (orgId: string) => void;
  resetOrg: () => void;
  authenticate: (email: string) => void;
  completeProfile: (profile: DoctorOnboardingProfile) => void;
  setPin: (pin: string) => void;
  skipPin: (sharedDevice: boolean) => void;
  lock: () => void;
  unlock: (pin: string) => boolean;
  signOut: () => void;
}

export interface MockSessionValue {
  step: SessionStep;
  org?: Organization;
  email?: string;
  profile?: DoctorOnboardingProfile;
  canLock: boolean;
  attemptsLeft: number;
  actions: SessionActions;
}

const MAX_ATTEMPTS = 5;
const INACTIVITY_MS = 5 * 60 * 1000;
const DEVICE_KEY = "gg_doc_device";
const SESSION_KEY = "gg_doc_session";

// MOCK ONLY — not a real hash. Real PIN handling is device-secure + rate-limited server-side.
function hashPin(pin: string): string {
  let h = 0;
  for (let i = 0; i < pin.length; i++) h = (h * 31 + pin.charCodeAt(i)) | 0;
  return `h${h}`;
}

function readJSON(store: Storage, key: string): Record<string, unknown> {
  try {
    return JSON.parse(store.getItem(key) || "{}");
  } catch {
    return {};
  }
}

function loadState(): SessionState {
  const device = readJSON(localStorage, DEVICE_KEY);
  const session = readJSON(sessionStorage, SESSION_KEY);
  return {
    orgId: device.orgId as string | undefined,
    pinHash: device.pinHash as string | undefined,
    sharedDevice: Boolean(device.sharedDevice),
    signedIn: Boolean(session.signedIn),
    email: session.email as string | undefined,
    profile: device.profile as DoctorOnboardingProfile | undefined,
    pinSkipped: Boolean(device.pinSkipped),
    locked: Boolean(session.locked),
    attempts: Number(session.attempts) || 0,
  };
}

function persist(s: SessionState) {
  try {
    localStorage.setItem(
      DEVICE_KEY,
      JSON.stringify({
        orgId: s.orgId,
        pinHash: s.pinHash,
        sharedDevice: s.sharedDevice,
        profile: s.profile,
        pinSkipped: s.pinSkipped,
      }),
    );
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        signedIn: s.signedIn,
        email: s.email,
        locked: s.locked,
        attempts: s.attempts,
      }),
    );
  } catch {
    /* ignore storage failures in the mock */
  }
}

function deriveStep(s: SessionState): SessionStep {
  if (!s.orgId) return "choose_org";
  if (!s.signedIn) return "authenticate";
  if (!s.profile) return "complete_profile";
  if (s.locked && s.pinHash) return "locked";
  if (!s.pinHash && !s.pinSkipped && !s.sharedDevice) return "set_pin";
  return "ready";
}

const MockSessionContext = createContext<MockSessionValue | null>(null);
export { MockSessionContext };

export function DoctorSessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>(loadState);

  useEffect(() => {
    persist(state);
  }, [state]);

  const update = useCallback(
    (patch: Partial<SessionState>) => setState((prev) => ({ ...prev, ...patch })),
    [],
  );

  const lock = useCallback(() => setState((prev) => ({ ...prev, locked: true })), []);

  const signOut = useCallback(
    () =>
      setState((prev) => ({
        // Full sign-out revokes the session; the device PIN stays paired for the next login's
        // lock, but it never replaces a fresh full login. Org is remembered on this device.
        ...prev,
        signedIn: false,
        email: undefined,
        locked: false,
        attempts: 0,
      })),
    [],
  );

  const actions = useMemo<SessionActions>(
    () => ({
      chooseOrg: (orgId) => update({ orgId }),
      resetOrg: () => update({ orgId: undefined }),
      authenticate: (email) => update({ signedIn: true, email, locked: false, attempts: 0 }),
      completeProfile: (profile) => update({ profile }),
      setPin: (pin) => update({ pinHash: hashPin(pin), pinSkipped: false, locked: false }),
      skipPin: (sharedDevice) => update({ pinSkipped: true, sharedDevice }),
      lock,
      unlock: (pin) => {
        let ok = false;
        setState((prev) => {
          if (prev.pinHash && hashPin(pin) === prev.pinHash) {
            ok = true;
            return { ...prev, locked: false, attempts: 0 };
          }
          const attempts = prev.attempts + 1;
          if (attempts >= MAX_ATTEMPTS) {
            // Too many tries → drop the session, force a full login.
            return {
              ...prev,
              signedIn: false,
              email: undefined,
              locked: false,
              attempts: 0,
            };
          }
          return { ...prev, attempts };
        });
        return ok;
      },
      signOut,
    }),
    [update, lock, signOut],
  );

  const canLock = Boolean(state.pinHash) && state.signedIn;

  // Inactivity auto-lock (only when a PIN exists to unlock with).
  useEffect(() => {
    if (!canLock) return;
    let timer = window.setTimeout(lock, INACTIVITY_MS);
    const reset = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(lock, INACTIVITY_MS);
    };
    const events: (keyof WindowEventMap)[] = ["click", "keydown", "scroll"];
    events.forEach((e) => window.addEventListener(e, reset));
    return () => {
      window.clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [canLock, lock]);

  const value = useMemo<MockSessionValue>(() => {
    const org = mockOrganizations().find((o) => o.id === state.orgId);
    return {
      step: deriveStep(state),
      org,
      email: state.email,
      profile: state.profile,
      canLock,
      attemptsLeft: MAX_ATTEMPTS - state.attempts,
      actions,
    };
  }, [state, canLock, actions]);

  return <MockSessionContext.Provider value={value}>{children}</MockSessionContext.Provider>;
}

export function useDoctorSession(): MockSessionValue {
  const value = useContext(MockSessionContext);
  if (!value) throw new Error("useDoctorSession must be used within DoctorSessionProvider");
  return value;
}
