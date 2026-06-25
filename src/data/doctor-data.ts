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
  mockPatientDetail,
  mockPatientList,
  mockProposeOrder,
  mockRequestLink,
  mockSendMessage,
} from "./mock";

/**
 * The single seam to the backend. Each hook returns DEV-ONLY mock data today. When the
 * canonical backend ships its functions and the generated Convex API is importable here
 * (DOCTOR_PORTAL_CANONICAL_BACKEND_SPEC.md §4, §7), replace each mock branch with the real
 * `useQuery` / `useMutation(api.*)` shown in the comment above it. No `api.*` is referenced
 * until then, so nothing imaginary is wired.
 */

export function useDoctorPatients(): QueryResult<DoctorPatientListItem[]> {
  // REAL: const data = useQuery(api.doctorPatients.list);
  //       return { data, isLoading: data === undefined, error: null };
  const data = useMemo(() => (USE_MOCK_DATA ? mockPatientList() : undefined), []);
  return { data, isLoading: false, error: null };
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

export function useRequestLink(): Mutation<string, { status: string }> {
  // REAL: const run = (accessCode) => convexMutation(api.doctorPatients.requestLink, { accessCode });
  const run = useCallback((accessCode: string) => mockRequestLink(accessCode), []);
  return useMutation(run);
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
