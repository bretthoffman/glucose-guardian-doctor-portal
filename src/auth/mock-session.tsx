import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { DoctorProfile } from "@doctor-portal/api-client-react";
import { mockOrganizations, type MockOrganization } from "@/data/mock";
import { clearDoctorSession, loadDoctorSession, storeDoctorSession } from "./doctor-auth";
import { hashPin, setAccountPin, verifyAccountPin } from "./pin-backend";

/**
 * Doctor session for the portal: sign-in first (backend doctor accounts, Bearer token) → mandatory
 * PIN lock. The PIN is account-level (stored server-side, see pin-backend) so it follows the doctor
 * to any clinic computer; a locally-cached hash mirrors it for instant/offline unlock and as the
 * fallback until the backend routes ship. Creating an account routes through the organization
 * picker inside the `authenticate` step (see MockAuthFlow) — returning doctors never see it. The
 * token/doctor live in doctor-auth (sessionStorage); org + cached PIN live on the device.
 */
export type SessionStep = "authenticate" | "set_pin" | "locked" | "ready";

interface SessionState {
  orgId?: string;
  /** Persisted at pick time so orgs from the server-side directory resolve after reload. */
  orgName?: string;
  orgDomains?: string[];
  /** Device-cached PIN hash — mirrors the account PIN for offline unlock and pre-deploy fallback. */
  pinHash?: string;
  /**
   * Whether the signed-in account has a server-side PIN. `undefined` means unknown (older backend
   * without the field) — then the device-cached `pinHash` governs, preserving legacy behavior.
   */
  accountHasPin?: boolean;
  doctor?: DoctorProfile;
  locked: boolean;
  attempts: number;
}

export interface SessionActions {
  chooseOrg: (org: { id: string; name?: string; allowedDomains?: string[] }) => void;
  resetOrg: () => void;
  authenticate: (doctor: DoctorProfile, token: string, expiresAt: number) => void;
  setPin: (pin: string) => Promise<void>;
  lock: () => void;
  unlock: (pin: string) => Promise<boolean>;
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

function readJSON(store: Storage, key: string): Record<string, unknown> {
  try {
    return JSON.parse(store.getItem(key) || "{}");
  } catch {
    return {};
  }
}

/** Account PIN when known, else the device-cached hash (legacy / offline). */
function pinIsSet(s: SessionState): boolean {
  return s.accountHasPin ?? Boolean(s.pinHash);
}

function loadState(): SessionState {
  const device = readJSON(localStorage, DEVICE_KEY);
  const flags = readJSON(sessionStorage, FLAGS_KEY);
  const session = loadDoctorSession();
  const flagHasPin =
    typeof flags.accountHasPin === "boolean" ? (flags.accountHasPin as boolean) : undefined;
  return {
    orgId: device.orgId as string | undefined,
    orgName: device.orgName as string | undefined,
    orgDomains: Array.isArray(device.orgDomains) ? (device.orgDomains as string[]) : undefined,
    pinHash: device.pinHash as string | undefined,
    accountHasPin: flagHasPin ?? session?.doctor?.hasPin,
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
      }),
    );
    sessionStorage.setItem(
      FLAGS_KEY,
      JSON.stringify({ locked: s.locked, attempts: s.attempts, accountHasPin: s.accountHasPin }),
    );
  } catch {
    /* ignore */
  }
}

function deriveStep(s: SessionState): SessionStep {
  // Sign-in comes first; the org is picked inside the create-account path, not as a gate.
  if (!s.doctor) return "authenticate";
  if (s.locked && pinIsSet(s)) return "locked";
  // A 4-digit PIN is required — no skip. An account without one (new account, or a returning
  // doctor whose device-only PIN predates account PINs) is sent here to set one.
  if (!pinIsSet(s)) return "set_pin";
  return "ready";
}

const MockSessionContext = createContext<MockSessionValue | null>(null);
export { MockSessionContext };

export function DoctorSessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>(loadState);

  // Always-current snapshot so the async PIN actions can read the latest doctor/pinHash without
  // being re-created (and re-subscribing the idle timer) on every state change.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
    persist(state);
  }, [state]);

  const update = useCallback(
    (patch: Partial<SessionState>) => setState((prev) => ({ ...prev, ...patch })),
    [],
  );

  const lock = useCallback(() => setState((prev) => ({ ...prev, locked: true })), []);

  const signOut = useCallback(() => {
    clearDoctorSession();
    setState((prev) => ({
      ...prev,
      doctor: undefined,
      // The cached hash + hasPin belong to the doctor signing out — never leave them as a fallback
      // for the next doctor on a shared clinic computer.
      pinHash: undefined,
      accountHasPin: undefined,
      locked: false,
      attempts: 0,
    }));
  }, []);

  const actions = useMemo<SessionActions>(
    () => ({
      chooseOrg: (org) =>
        update({ orgId: org.id, orgName: org.name, orgDomains: org.allowedDomains }),
      resetOrg: () => update({ orgId: undefined, orgName: undefined, orgDomains: undefined }),
      authenticate: (doctor, token, expiresAt) => {
        storeDoctorSession({ token, expiresAt, doctor });
        update({ doctor, accountHasPin: doctor.hasPin, locked: false, attempts: 0 });
      },
      setPin: async (pin) => {
        const pinHash = hashPin(pin);
        // Persist to the account so the PIN follows the doctor to any device. Best-effort: if the
        // backend route isn't live yet we still cache locally so this device works today.
        const persisted = await setAccountPin(pinHash);
        setState((prev) => ({
          ...prev,
          pinHash,
          accountHasPin: persisted ? true : prev.accountHasPin,
          locked: false,
        }));
      },
      lock,
      unlock: async (pin) => {
        const pinHash = hashPin(pin);
        const cached = stateRef.current.pinHash;
        // Prefer the account PIN; fall back to the device cache when the server can't answer
        // (route missing, offline, or no server PIN yet).
        const server = await verifyAccountPin(pinHash);
        const ok = server ?? (!!cached && cached === pinHash);
        if (ok) {
          // Cache the verified hash so subsequent unlocks work instantly/offline on this device.
          setState((prev) => ({ ...prev, pinHash, locked: false, attempts: 0 }));
          return true;
        }
        setState((prev) => {
          const attempts = prev.attempts + 1;
          if (attempts >= MAX_ATTEMPTS) {
            clearDoctorSession();
            return {
              ...prev,
              doctor: undefined,
              pinHash: undefined,
              accountHasPin: undefined,
              locked: false,
              attempts: 0,
            };
          }
          return { ...prev, attempts };
        });
        return false;
      },
      signOut,
    }),
    [update, lock, signOut],
  );

  const canLock = pinIsSet(state) && Boolean(state.doctor);

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
