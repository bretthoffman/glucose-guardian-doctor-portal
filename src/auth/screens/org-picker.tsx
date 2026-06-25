import { mockOrganizations } from "@/data/mock";
import { useDoctorSession } from "../mock-session";
import { AuthShell } from "./auth-shell";
import { OrgList } from "./org-list";

export function OrgPicker() {
  const { actions } = useDoctorSession();
  return (
    <AuthShell title="Find your organization" subtitle="Select where you work to continue.">
      <OrgList orgs={mockOrganizations()} onSelect={actions.chooseOrg} />
    </AuthShell>
  );
}
