import { SignUp } from "@clerk/clerk-react";
import { LoginOrgGate } from "@/auth/login-org-gate";

// Work-email only — no Google.
const EMAIL_ONLY = {
  elements: {
    socialButtonsRoot: { display: "none" },
    socialButtonsBlockButton: { display: "none" },
    socialButtonsIconButton: { display: "none" },
    dividerRow: { display: "none" },
  },
};

export default function SignUpPage() {
  return (
    <LoginOrgGate title="Create your account">
      {() => <SignUp signInUrl="/login" fallbackRedirectUrl="/" appearance={EMAIL_ONLY} />}
    </LoginOrgGate>
  );
}
