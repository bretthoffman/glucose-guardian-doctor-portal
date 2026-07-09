import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ApiError,
  customFetch,
  useGetPatientData,
  useLinkDoctorPatient,
  useListDoctorLinkedPatients,
  useUnlinkDoctorPatient,
} from "@doctor-portal/api-client-react";
import type {
  DoctorLinkedPatient,
  DoctorLinkPatientResponse,
  DoctorMessage,
  PatientSnapshot,
} from "@doctor-portal/api-client-react";
import type {
  PatientDetail,
  ProposeOrderInput,
  QueryResult,
  TherapyOrder,
} from "./contracts";
import { USE_MOCK_DATA, mockMessages, mockSendMessage } from "./mock";
import { normalizeOrgName, searchOrganizations } from "./organizations";
import type { MockOrganization } from "./mock";
/**
 * Patient data comes from the live Glucose Guardian backend, authenticated with the doctor's
 * Bearer token. Linked patients come from GET /api/doctor/me/patients; linking by Doctor Code
 * goes through POST /api/doctor/me/patients/link. The organization directory stays mock.
 */

// ---- Real patient data by Doctor Code ----

export function usePatientSnapshot(accessCode: string): {
  snapshot: PatientSnapshot | undefined;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: () => void;
} {
  const res = useGetPatientData(accessCode, {
    // @ts-expect-error Generated hook merges partial query options at runtime
    query: { enabled: !!accessCode, refetchInterval: 30000 },
  });
  return {
    snapshot: res.data as PatientSnapshot | undefined,
    isLoading: res.isLoading,
    isFetching: res.isFetching,
    error: (res.error as Error | null) ?? null,
    refetch: () => {
      void res.refetch();
    },
  };
}

/** Server-side therapy proposal/decision fields (present once the comms backend is deployed). */
interface ServerTherapyProposal {
  id: string;
  proposedAt: string;
  proposedByDoctorId: string;
  proposedByName: string;
  note: string;
  carbRatio?: number;
  correctionFactor?: number;
  targetGlucose?: number;
}
interface ServerTherapyDecision {
  proposalId: string;
  status: "approved" | "declined";
  decidedAt: string;
}
type SnapshotWithOrders = PatientSnapshot & {
  therapyProposal?: ServerTherapyProposal | null;
  therapyDecision?: ServerTherapyDecision | null;
  settingsHistory?: {
    changedAt: string;
    carbRatio?: number;
    correctionFactor?: number;
    targetGlucose?: number;
  }[];
};

function proposalToOrder(p: ServerTherapyProposal, patientId: string): TherapyOrder {
  return {
    id: p.id,
    patientId,
    version: 0,
    status: "proposed",
    proposedByDoctorId: p.proposedByDoctorId,
    proposedByName: p.proposedByName,
    proposedAt: p.proposedAt,
    note: p.note,
    carbRatio: p.carbRatio,
    correctionFactor: p.correctionFactor,
    targetGlucose: p.targetGlucose,
  };
}

function snapshotToDetail(accessCode: string, snapshot: PatientSnapshot): PatientDetail {
  const p = snapshot.profile;
  const a = snapshot.alertPreferences;
  const s = snapshot as SnapshotWithOrders;
  return {
    patientId: accessCode,
    accessCode,
    snapshot,
    canPrescribe: true,
    activeOrder: {
      id: `order_${accessCode}`,
      patientId: accessCode,
      version: 1,
      status: "active",
      proposedByDoctorId: "app",
      proposedByName: "Current settings",
      proposedAt: snapshot.syncedAt,
      carbRatio: p.carbRatio,
      correctionFactor: p.correctionFactor,
      targetGlucose: p.targetGlucose,
      insulinTypes: p.insulinTypes,
      alertThresholds: a
        ? {
            low: a.lowThreshold,
            high: a.highThreshold,
            urgentLow: a.urgentLowThreshold,
            urgentHigh: a.urgentHighThreshold,
          }
        : undefined,
    },
    proposedOrder: s.therapyProposal ? proposalToOrder(s.therapyProposal, accessCode) : undefined,
    lastDecision: s.therapyDecision ?? undefined,
    settingsHistory: s.settingsHistory ?? undefined,
  };
}

export function usePatientDetail(
  accessCode: string,
): QueryResult<PatientDetail> & { isFetching: boolean; refetch: () => void } {
  const { snapshot, isLoading, isFetching, error, refetch } = usePatientSnapshot(accessCode);
  const data = useMemo(
    () => (snapshot ? snapshotToDetail(accessCode, snapshot) : undefined),
    [accessCode, snapshot],
  );
  return { data, isLoading, error, isFetching, refetch };
}

// ---- Linked patients (device-stored until a backend grant table exists) ----

export function useDoctorPatients(): {
  data: DoctorLinkedPatient[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
} {
  const res = useListDoctorLinkedPatients();
  return {
    data: res.data?.patients ?? [],
    isLoading: res.isLoading,
    error: (res.error as Error | null) ?? null,
    refetch: () => {
      void res.refetch();
    },
  };
}

export function useLinkPatient(): {
  mutate: (code: string) => Promise<DoctorLinkPatientResponse>;
  isPending: boolean;
  error: Error | null;
} {
  const link = useLinkDoctorPatient();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const mutate = useCallback(
    async (code: string) => {
      setIsPending(true);
      setError(null);
      try {
        // Auto-links by the patient's Doctor Code — the code itself is the consent.
        return await link.mutateAsync({ data: { accessCode: code } });
      } catch (e) {
        const err =
          e instanceof Error
            ? new Error("That code isn't valid, or your session expired. Check the Doctor Code.")
            : new Error("Could not link patient.");
        setError(err);
        throw err;
      } finally {
        setIsPending(false);
      }
    },
    [link],
  );
  return { mutate, isPending, error };
}

export function useUnlinkPatient(): {
  mutate: (accessCode: string) => Promise<void>;
  isPending: boolean;
  error: Error | null;
} {
  const unlink = useUnlinkDoctorPatient();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const mutate = useCallback(
    async (accessCode: string) => {
      setIsPending(true);
      setError(null);
      try {
        // Soft-unlink: revokes this doctor's link only. The patient's account and data stay in
        // Glucose Guardian and can be re-linked later with the same Doctor Code.
        await unlink.mutateAsync({ accessCode });
      } catch (e) {
        const err = e instanceof Error ? e : new Error("Could not remove patient.");
        setError(err);
        throw err;
      } finally {
        setIsPending(false);
      }
    },
    [unlink],
  );
  return { mutate, isPending, error };
}

// ---- Local / mock helpers (treatment-settings propose, messages, org search) ----

export interface Mutation<TInput, TResult> {
  mutate: (input: TInput) => Promise<TResult>;
  isPending: boolean;
  error: Error | null;
}

function useLocalMutation<TInput, TResult>(
  run: (input: TInput) => Promise<TResult>,
): Mutation<TInput, TResult> {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const mutate = useCallback(
    async (input: TInput) => {
      setIsPending(true);
      setError(null);
      try {
        return await run(input);
      } catch (e) {
        const err = e instanceof Error ? e : new Error("Request failed");
        setError(err);
        throw err;
      } finally {
        setIsPending(false);
      }
    },
    [run],
  );
  return { mutate, isPending, error };
}

export function useProposeOrder(): Mutation<ProposeOrderInput, TherapyOrder> {
  // Real proposal: POST /api/doctor/patient/:code/orders stores it server-side; the caregiver
  // approves or declines it in the Glucose Guardian app (the approval card arrives on the app's
  // next sync). patientId here is the patient's access code.
  const run = useCallback(async (input: ProposeOrderInput) => {
    try {
      const proposal = await customFetch<ServerTherapyProposal>(
        `/api/doctor/patient/${encodeURIComponent(input.patientId)}/orders`,
        {
          method: "POST",
          body: JSON.stringify({
            carbRatio: input.values.carbRatio,
            correctionFactor: input.values.correctionFactor,
            targetGlucose: input.values.targetGlucose,
            note: input.note,
          }),
        },
      );
      return proposalToOrder(proposal, input.patientId);
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.status === 404 || e.status === 405) {
          throw new Error(
            "The backend doesn't accept treatment proposals yet — the server update is pending deployment.",
          );
        }
        if (e.status === 409) {
          throw new Error(
            "A change is already awaiting caregiver confirmation. You can propose another once it's resolved.",
          );
        }
      }
      throw e instanceof Error ? e : new Error("Could not propose the change.");
    }
  }, []);
  return useLocalMutation(run);
}

export function useSendMessage(accessCode: string): Mutation<string, DoctorMessage> {
  const run = useCallback((text: string) => mockSendMessage(accessCode, text), [accessCode]);
  return useLocalMutation(run);
}

export function useDoctorMessages(accessCode: string): QueryResult<DoctorMessage[]> {
  const data = useMemo(
    () => (USE_MOCK_DATA ? mockMessages(accessCode) : undefined),
    [accessCode],
  );
  return { data, isLoading: false, error: null };
}

export function useSeededMessages(accessCode: string): {
  messages: DoctorMessage[];
  append: (m: DoctorMessage) => void;
} {
  const { data } = useDoctorMessages(accessCode);
  const [messages, setMessages] = useState<DoctorMessage[]>(data ?? []);
  useEffect(() => {
    if (data) setMessages(data);
  }, [data]);
  const append = useCallback((m: DoctorMessage) => setMessages((prev) => [...prev, m]), []);
  return { messages, append };
}

interface RemoteOrg {
  id: string;
  name: string;
  domains?: string[];
  city?: string;
  state?: string;
}

/**
 * Organization directory search. Two sources, one search box:
 *  - Curated local directory (instant, offline, ~230 major U.S. systems).
 *  - Server-side directory at GET /api/doctor/organizations (CMS/NPPES import — the long tail),
 *    debounced as the doctor types. If the endpoint isn't deployed or fails, local results
 *    stand alone, so this never breaks the sign-in flow.
 * Results are merged and deduped by normalized name + state, curated entries first.
 */
export function useOrganizationSearch(query: string): MockOrganization[] {
  const local = useMemo(() => searchOrganizations(query), [query]);
  const [remote, setRemote] = useState<MockOrganization[]>([]);

  useEffect(() => {
    const q = query.trim();
    setRemote([]);
    if (q.length < 2) return;
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const base = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
          const res = await fetch(
            `${base}/api/doctor/organizations?q=${encodeURIComponent(q)}&limit=12`,
            { signal: ctrl.signal },
          );
          if (!res.ok) return;
          const body = (await res.json()) as { organizations?: RemoteOrg[] };
          setRemote(
            (body.organizations ?? []).map((o) => ({
              id: o.id,
              name: o.name,
              slug: o.id,
              allowedDomains: o.domains ?? [],
              city: o.city,
              state: o.state,
            })),
          );
        } catch {
          /* offline or directory not deployed yet — local results already cover it */
        }
      })();
    }, 250);
    return () => {
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [query]);

  return useMemo(() => {
    const seen = new Set<string>();
    const out: MockOrganization[] = [];
    for (const o of [...local, ...remote]) {
      const key = `${normalizeOrgName(o.name)}|${(o.state ?? "").toUpperCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(o);
      if (out.length >= 12) break;
    }
    return out;
  }, [local, remote]);
}
