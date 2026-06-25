import { useContext } from "react";
import { useConvexAuth } from "convex/react";
import { USE_MOCK_DATA, MOCK_DOCTOR, MOCK_ORG } from "@/data/mock";
import { MockSessionContext } from "./mock-session";

export interface DoctorProfile {
  id: string;
  displayName: string;
  email: string;
  role: "doctor" | "org_admin";
  specialty?: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
}

/**
 * Authorization state for the signed-in user, mirroring `doctors.getCurrent` from the
 * canonical backend (see DOCTOR_PORTAL_CANONICAL_BACKEND_SPEC.md §4). Identity comes
 * from Clerk; this *authorization* status must come from Convex, never the browser.
 *
 * - In DEV (mock on), reflects the org and profile from the mock onboarding session so the
 *   header matches what the doctor chose/entered.
 * - In production (mock off), this is BACKEND PENDING: every authenticated user resolves to
 *   `not_provisioned` until `doctors.getCurrent` and the generated Convex API exist (spec §7).
 *   Do not fabricate an `api.doctors.*` reference here.
 *
 * When the backend is ready, replace the production branch with:
 *
 *   const result = useQuery(api.doctors.getCurrent);
 *   if (result === undefined) return { status: "loading" };
 *   return result; // discriminated union matching DoctorAccessState (minus "loading")
 */
export type DoctorAccessState =
  | { status: "loading" }
  | { status: "not_provisioned" }
  | { status: "pending" }
  | { status: "suspended" }
  | { status: "active"; doctor: DoctorProfile; organization: Organization };

export function useCurrentDoctor(): DoctorAccessState {
  const { isLoading } = useConvexAuth();
  const session = useContext(MockSessionContext);

  if (USE_MOCK_DATA) {
    const doctor: DoctorProfile = session?.profile
      ? {
          id: MOCK_DOCTOR.id,
          displayName: session.profile.fullName,
          email: session.email ?? MOCK_DOCTOR.email,
          role: "doctor",
          specialty: session.profile.specialty,
        }
      : MOCK_DOCTOR;
    return { status: "active", doctor, organization: session?.org ?? MOCK_ORG };
  }

  if (isLoading) return { status: "loading" };
  return { status: "not_provisioned" };
}
