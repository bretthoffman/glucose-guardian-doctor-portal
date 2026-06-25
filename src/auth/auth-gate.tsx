import type { ReactNode } from "react";
import { Redirect } from "wouter";
import { useUser } from "@clerk/clerk-react";
import { LoadingScreen } from "@/components/LoadingScreen";
import { USE_MOCK_DATA } from "@/data/mock";
import { useCurrentDoctor } from "./use-current-doctor";
import { NotProvisionedScreen, PendingScreen, SuspendedScreen } from "./access-states";
import { MockAuthFlow } from "./mock-auth-flow";

/**
 * Route guard. In production, Clerk decides signed-in vs signed-out and Convex decides
 * authorization (`children` render only for an active doctor). In DEV, the redesigned mock
 * onboarding/session flow gates access instead, so the new first-run experience is previewable
 * without Clerk or the backend.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useUser();
  const access = useCurrentDoctor();

  if (USE_MOCK_DATA) {
    return <MockAuthFlow>{children}</MockAuthFlow>;
  }

  if (!isLoaded) return <LoadingScreen message="Checking your session…" />;
  if (!isSignedIn) return <Redirect to="/login" />;

  switch (access.status) {
    case "loading":
      return <LoadingScreen message="Verifying doctor access…" />;
    case "not_provisioned":
      return <NotProvisionedScreen />;
    case "pending":
      return <PendingScreen />;
    case "suspended":
      return <SuspendedScreen />;
    case "active":
      return <>{children}</>;
  }
}
