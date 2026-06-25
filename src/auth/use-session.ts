import { useContext } from "react";
import { useClerk } from "@clerk/clerk-react";
import { USE_MOCK_DATA } from "@/data/mock";
import { MockSessionContext } from "./mock-session";

/**
 * Unified session controls for the app shell (sign out, lock). Backed by the mock session in
 * dev and by Clerk in production. Both underlying hooks are always called to satisfy the rules
 * of hooks; only the result is chosen.
 */
export function useSession(): {
  signOut: () => void;
  lock: () => void;
  canLock: boolean;
} {
  const clerk = useClerk();
  const mock = useContext(MockSessionContext);

  if (USE_MOCK_DATA && mock) {
    return { signOut: mock.actions.signOut, lock: mock.actions.lock, canLock: mock.canLock };
  }
  return {
    signOut: () => {
      void clerk.signOut();
    },
    lock: () => {},
    canLock: false,
  };
}
