/**
 * Validated browser environment for the doctor portal.
 *
 * Only VITE_-prefixed variables are exposed to the client by Vite. This module fails
 * fast with a clear message naming any missing variable — it never logs the values.
 *
 * This is a static SPA with no server runtime, so server-only secrets (e.g.
 * CLERK_SECRET_KEY) must NEVER appear here or in any VITE_ variable. Server-side Clerk
 * work belongs in the Convex backend.
 */

function ensurePresent(vars: Record<string, string | undefined>): void {
  const missing = Object.entries(vars)
    .filter(([, value]) => !value || !value.trim())
    .map(([name]) => name);
  if (missing.length > 0) {
    throw new Error(
      `[doctor-portal] Missing required environment variable(s): ${missing.join(", ")}. ` +
        "Add them to .env.local (see .env.example). Values are never logged.",
    );
  }
}

ensurePresent({
  VITE_CONVEX_URL: import.meta.env.VITE_CONVEX_URL,
  VITE_CLERK_PUBLISHABLE_KEY: import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
});

export const env = {
  /** Convex cloud URL, e.g. https://clean-ptarmigan-904.convex.cloud */
  convexUrl: import.meta.env.VITE_CONVEX_URL,
  /** Clerk publishable (public) key — never the secret key. */
  clerkPublishableKey: import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
  /** Optional: only set when the portal calls Convex HTTP actions (.convex.site). */
  convexSiteUrl: import.meta.env.VITE_CONVEX_SITE_URL,
} as const;
