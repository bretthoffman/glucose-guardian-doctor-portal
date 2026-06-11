/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Public API origin for production builds (e.g. https://glucose-guardian-ashen.vercel.app). */
  readonly VITE_API_BASE_URL?: string;
  /** Local dev only: Vite proxy target when VITE_API_BASE_URL is unset. */
  readonly VITE_API_PROXY_TARGET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
