import { useState, type ReactNode } from "react";
import { Building2 } from "lucide-react";
import { mockOrganizations, type MockOrganization } from "@/data/mock";
import { AuthShell } from "./screens/auth-shell";
import { OrgList } from "./screens/org-list";

const ORG_KEY = "gg_doc_login_org";

/**
 * Production org-first wrapper for the Clerk login / sign-up pages: pick an organization first,
 * then render the (email-only) Clerk widget for it. Works in dev and production — it does not
 * depend on the mock seam. The org list is a static placeholder until the backend exposes
 * `api.organizations.list`.
 */
export function LoginOrgGate({
  title,
  children,
}: {
  title: string;
  children: (org: MockOrganization) => ReactNode;
}) {
  const orgs = mockOrganizations();
  const [orgId, setOrgId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(ORG_KEY);
    } catch {
      return null;
    }
  });
  const org = orgs.find((o) => o.id === orgId) ?? null;

  if (!org) {
    return (
      <AuthShell title="Find your organization" subtitle="Select where you work to continue.">
        <OrgList
          orgs={orgs}
          onSelect={(id) => {
            try {
              localStorage.setItem(ORG_KEY, id);
            } catch {
              /* ignore storage failures */
            }
            setOrgId(id);
          }}
        />
      </AuthShell>
    );
  }

  return (
    <AuthShell title={title} subtitle={`${org.name} · work email`} card={false}>
      {children(org)}
      <button
        onClick={() => {
          try {
            localStorage.removeItem(ORG_KEY);
          } catch {
            /* ignore storage failures */
          }
          setOrgId(null);
        }}
        className="mt-4 text-sm text-muted-foreground hover:text-foreground flex items-center justify-center gap-1"
      >
        <Building2 className="w-3.5 h-3.5" /> Change organization
      </button>
    </AuthShell>
  );
}
