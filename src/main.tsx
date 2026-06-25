import { createRoot } from "react-dom/client";
import { ClerkProvider, useAuth } from "@clerk/clerk-react";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import App from "./App";
import { env } from "@/lib/env";
import "./index.css";

const convex = new ConvexReactClient(env.convexUrl);

createRoot(document.getElementById("root")!).render(
  <ClerkProvider publishableKey={env.clerkPublishableKey} afterSignOutUrl="/login">
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      <App />
    </ConvexProviderWithClerk>
  </ClerkProvider>,
);
