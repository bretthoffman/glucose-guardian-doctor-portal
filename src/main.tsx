import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const apiBase = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "");
if (import.meta.env.DEV && !apiBase) {
  const proxyTarget = import.meta.env.VITE_API_PROXY_TARGET ?? "http://localhost:3000";
  console.info(`[doctor-portal] API: /api/* proxied to ${proxyTarget}`);
} else if (import.meta.env.PROD && !apiBase) {
  console.warn(
    "[doctor-portal] VITE_API_BASE_URL is not set; API calls use same-origin /api paths.",
  );
}

createRoot(document.getElementById("root")!).render(<App />);
