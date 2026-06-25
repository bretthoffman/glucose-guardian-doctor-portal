/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Convex cloud URL (browser-safe). e.g. https://clean-ptarmigan-904.convex.cloud */
  readonly VITE_CONVEX_URL: string;
  /** Clerk publishable (public) key (browser-safe). Never the secret key. */
  readonly VITE_CLERK_PUBLISHABLE_KEY: string;
  /** Optional: Convex site URL, only if the portal calls Convex HTTP actions. */
  readonly VITE_CONVEX_SITE_URL?: string;
  /** Dev-only: set to "true" to disable mock data and develop against the real backend. */
  readonly VITE_DISABLE_MOCK?: string;
  /** Legacy REST API origin (being replaced by Convex). */
  readonly VITE_API_BASE_URL?: string;
  /** Legacy: local dev Vite proxy target when VITE_API_BASE_URL is unset. */
  readonly VITE_API_PROXY_TARGET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
