import { useCallback, useEffect, useMemo, useState } from "react";
import type { DoctorMessage } from "@doctor-portal/api-client-react";
import type {
  DoctorPatientListItem,
  PatientDetail,
  ProposeOrderInput,
  QueryResult,
  TherapyOrder,
} from "./contracts";
import {
  USE_MOCK_DATA,
  mockMessages,
  mockOrganizations,
  mockPatientDetail,
  mockLinkPatient,
  mockPatientList,
  mockProposeOrder,
  mockSendMessage,
} from "./mock";
import type { MockOrganization } from "./mock";

/**
 * The single seam to the backend. Each hook returns DEV-ONLY mock data today. When the
 * canonical backend ships its functions and the generated Convex API is importable here
 * (DOCTOR_PORTAL_CANONICAL_BACKEND_SPEC.md §4, §7), replace each mock branch with the real
 * `useQuery` / `useMutation(api.*)` shown in the comment above it. No `api.*` is referenced
 * until then, so nothing imaginary is wired.
 */

export function useDoctorPatients(): QueryResult<DoctorPatientListItem[]> & {
  refetch: () => void;
} {
  // REAL: const data = useQuery(api.doctorPatients.list); — live, so refetch is a no-op there.
  const [version, setVersion] = useState(0);
  const data = useMemo(() => (USE_MOCK_DATA ? mockPatientList() : undefined), [version]);
  return { data, isLoading: false, error: null, refetch: () => setVersion((v) => v + 1) };
}

export function usePatientDetail(accessCode: string): QueryResult<PatientDetail> {
  // REAL: const data = useQuery(api.doctorPatients.get, { accessCode });
  //       return { data, isLoading: data === undefined, error: null };
  const data = useMemo(
    () => (USE_MOCK_DATA ? mockPatientDetail(accessCode) : undefined),
    [accessCode],
  );
  return { data, isLoading: false, error: null };
}

export function useDoctorMessages(accessCode: string): QueryResult<DoctorMessage[]> {
  // REAL: const data = useQuery(api.doctorMessages.list, { accessCode });
  const data = useMemo(
    () => (USE_MOCK_DATA ? mockMessages(accessCode) : undefined),
    [accessCode],
  );
  return { data, isLoading: false, error: null };
}

export interface Mutation<TInput, TResult> {
  mutate: (input: TInput) => Promise<TResult>;
  isPending: boolean;
  error: Error | null;
}

function useMutation<TInput, TResult>(
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
  // REAL: const run = (input) => convexMutation(api.therapyOrders.propose, input);
  const run = useCallback((input: ProposeOrderInput) => mockProposeOrder(input), []);
  return useMutation(run);
}

export function useSendMessage(accessCode: string): Mutation<string, DoctorMessage> {
  // REAL: const run = (text) => convexMutation(api.doctorMessages.send, { accessCode, body: text });
  const run = useCallback((text: string) => mockSendMessage(accessCode, text), [accessCode]);
  return useMutation(run);
}

export function useLinkPatient(): Mutation<string, DoctorPatientListItem> {
  // REAL: const run = (accessCode) => convexMutation(api.doctorPatients.link, { accessCode });
  // Auto-links (no approval request); the patient appears in the list immediately.
  const run = useCallback((accessCode: string) => mockLinkPatient(accessCode), []);
  return useMutation(run);
}

/**
 * Organization directory search for the login org picker (public, pre-auth).
 *
 * Mock filters a tiny static list. Production must back this with a real server-side directory —
 * the full US set can't ship in the SPA. Source it from CMS NPPES (endocrinology taxonomy
 * 207RE0101X) or curate per onboarding. See DOCTOR_PORTAL_CANONICAL_BACKEND_SPEC.md §4.
 *
 * REAL: return useQuery(api.organizations.search, q.length >= 2 ? { query: q } : "skip") ?? [];
 */
export function useOrganizationSearch(query: string): MockOrganization[] {
  return useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return mockOrganizations().filter(
      (o) => o.name.toLowerCase().includes(q) || o.allowedDomains.some((d) => d.includes(q)),
    );
  }, [query]);
}

/** Small helper so message views can seed local state from the (memoized) query result. */
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
