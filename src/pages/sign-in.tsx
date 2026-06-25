import { SignIn } from "@clerk/clerk-react";

export default function SignInPage() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background relative overflow-hidden">
      <div className="absolute inset-0 z-0">
        <img
          src={`${import.meta.env.BASE_URL}images/login-bg.svg`}
          alt=""
          aria-hidden="true"
          className="w-full h-full object-cover opacity-20"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/95 to-background" />
      </div>

      <div className="w-full max-w-md p-6 relative z-10 flex flex-col items-center">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-foreground mb-1">Gluco Guardian</h1>
          <p className="text-muted-foreground">Doctor &amp; Care Team Portal</p>
        </div>

        <SignIn
          fallbackRedirectUrl="/"
          appearance={{
            elements: {
              // Doctors sign in with a work email, not Google — hide social + the divider.
              socialButtonsRoot: { display: "none" },
              socialButtonsBlockButton: { display: "none" },
              socialButtonsIconButton: { display: "none" },
              dividerRow: { display: "none" },
            },
          }}
        />

        <p className="text-center text-sm text-muted-foreground mt-6">
          Secure access to pediatric diabetes data.
        </p>
      </div>
    </div>
  );
}
