import { useDoctorSession } from "../mock-session";
import { AuthShell } from "./auth-shell";
import { OrgList } from "./org-list";

export function OrgPicker() {
  const { actions } = useDoctorSession();
  return (
    <AuthShell title="Find your organization" subtitle="Search for where you work to continue.">
      <OrgList onSelect={actions.chooseOrg} />
    </AuthShell>
  );
}
