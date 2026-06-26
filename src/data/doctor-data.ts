import { useCallback, useEffect, useMemo, useState } from "react";
import {
  useGetPatientData,
  useLinkDoctorPatient,
  useListDoctorLinkedPatients,
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
import { USE_MOCK_DATA, mockMessages, mockOrganizations, mockProposeOrder, mockSendMessage } from "./mock";
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
  error: Error | null;
} {
  const res = useGetPatientData(accessCode, {
    // @ts-expect-error Generated hook merges partial query options at runtime
    query: { enabled: !!accessCode, refetchInterval: 30000 },
  });
  return {
    snapshot: res.data as PatientSnapshot | undefined,
    isLoading: res.isLoading,
    error: (res.error as Error | null) ?? null,
  };
}

function snapshotToDetail(accessCode: string, snapshot: PatientSnapshot): PatientDetail {
  const p = snapshot.profile;
  const a = snapshot.alertPreferences;
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
  };
}

export function usePatientDetail(accessCode: string): QueryResult<PatientDetail> {
  const { snapshot, isLoading, error } = usePatientSnapshot(accessCode);
  const data = useMemo(
    () => (snapshot ? snapshotToDetail(accessCode, snapshot) : undefined),
    [accessCode, snapshot],
  );
  return { data, isLoading, error };
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
  // Local for now — writing a ratio change back to the patient app needs a backend endpoint
  // (DOCTOR_PORTAL_CANONICAL_BACKEND_SPEC.md therapyOrders.propose). The UI shows real current
  // settings; the proposed change is held client-side until that endpoint exists.
  const run = useCallback((input: ProposeOrderInput) => mockProposeOrder(input), []);
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

export function useOrganizationSearch(query: string): MockOrganization[] {
  return useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return mockOrganizations().filter(
      (o) => o.name.toLowerCase().includes(q) || o.allowedDomains.some((d) => d.includes(q)),
    );
  }, [query]);
}
