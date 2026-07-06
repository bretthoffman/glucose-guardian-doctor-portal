import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { DoctorProfile } from "@doctor-portal/api-client-react";
import { mockOrganizations, type MockOrganization } from "@/data/mock";
import { clearDoctorSession, loadDoctorSession, storeDoctorSession } from "./doctor-auth";

/**
 * Doctor session for the portal: organization picker → real account sign-in (backend doctor
 * accounts, Bearer token) → optional device PIN lock. The token/doctor live in doctor-auth
 * (sessionStorage); org + PIN preferences live on the device (localStorage).
 */
export type SessionStep = "choose_org" | "authenticate" | "set_pin" | "locked" | "ready";

interface SessionState {
  orgId?: string;
  /** Persisted at pick time so orgs from the server-side directory resolve after reload. */
  orgName?: string;
  orgDomains?: string[];
  pinHash?: string;
  sharedDevice: boolean;
  pinSkipped: boolean;
  doctor?: DoctorProfile;
  locked: boolean;
  attempts: number;
}

export interface SessionActions {
  chooseOrg: (org: { id: string; name?: string; allowedDomains?: string[] }) => void;
  resetOrg: () => void;
  authenticate: (doctor: DoctorProfile, token: string, expiresAt: number) => void;
  setPin: (pin: string) => void;
  skipPin: (sharedDevice: boolean) => void;
  lock: () => void;
  unlock: (pin: string) => boolean;
  signOut: () => void;
}

export interface MockSessionValue {
  step: SessionStep;
  org?: MockOrganization;
  doctor?: DoctorProfile;
  canLock: boolean;
  attemptsLeft: number;
  actions: SessionActions;
}

const MAX_ATTEMPTS = 5;
const INACTIVITY_MS = 5 * 60 * 1000;
const DEVICE_KEY = "gg_doc_device";
const FLAGS_KEY = "gg_doc_session_flags";

// MOCK device PIN hash — not secure; the real security boundary is the backend token.
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
  const flags = readJSON(sessionStorage, FLAGS_KEY);
  const session = loadDoctorSession();
  return {
    orgId: device.orgId as string | undefined,
    orgName: device.orgName as string | undefined,
    orgDomains: Array.isArray(device.orgDomains) ? (device.orgDomains as string[]) : undefined,
    pinHash: device.pinHash as string | undefined,
    sharedDevice: Boolean(device.sharedDevice),
    pinSkipped: Boolean(device.pinSkipped),
    doctor: session?.doctor,
    locked: Boolean(flags.locked),
    attempts: Number(flags.attempts) || 0,
  };
}

function persist(s: SessionState): void {
  try {
    localStorage.setItem(
      DEVICE_KEY,
      JSON.stringify({
        orgId: s.orgId,
        orgName: s.orgName,
        orgDomains: s.orgDomains,
        pinHash: s.pinHash,
        sharedDevice: s.sharedDevice,
        pinSkipped: s.pinSkipped,
      }),
    );
    sessionStorage.setItem(FLAGS_KEY, JSON.stringify({ locked: s.locked, attempts: s.attempts }));
  } catch {
    /* ignore */
  }
}

function deriveStep(s: SessionState): SessionStep {
  if (!s.orgId) return "choose_org";
  if (!s.doctor) return "authenticate";
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

  const signOut = useCallback(() => {
    clearDoctorSession();
    setState((prev) => ({ ...prev, doctor: undefined, locked: false, attempts: 0 }));
  }, []);

  const actions = useMemo<SessionActions>(
    () => ({
      chooseOrg: (org) =>
        update({ orgId: org.id, orgName: org.name, orgDomains: org.allowedDomains }),
      resetOrg: () => update({ orgId: undefined, orgName: undefined, orgDomains: undefined }),
      authenticate: (doctor, token, expiresAt) => {
        storeDoctorSession({ token, expiresAt, doctor });
        update({ doctor, locked: false, attempts: 0 });
      },
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
            clearDoctorSession();
            return { ...prev, doctor: undefined, locked: false, attempts: 0 };
          }
          return { ...prev, attempts };
        });
        return ok;
      },
      signOut,
    }),
    [update, lock, signOut],
  );

  const canLock = Boolean(state.pinHash) && Boolean(state.doctor);

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
    // Prefer the org identity captured at pick time (covers server-directory orgs that aren't in
    // the bundled list); fall back to the curated list for devices stored before orgName existed.
    const fromList = mockOrganizations().find((o) => o.id === state.orgId);
    const org: MockOrganization | undefined = state.orgId
      ? (fromList ??
        (state.orgName
          ? {
              id: state.orgId,
              name: state.orgName,
              slug: state.orgId,
              allowedDomains: state.orgDomains ?? [],
            }
          : undefined))
      : undefined;
    return {
      step: deriveStep(state),
      org,
      doctor: state.doctor,
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
