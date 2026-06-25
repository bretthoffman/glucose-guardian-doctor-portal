import type { ReactNode } from "react";
import { Activity } from "lucide-react";

export function AuthShell({
  title,
  subtitle,
  children,
  width = "max-w-md",
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  width?: string;
}) {
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
      <div className={`w-full ${width} p-6 relative z-10`}>
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-primary/30">
            <Activity className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          {subtitle && <p className="text-muted-foreground mt-1 text-sm">{subtitle}</p>}
        </div>
        <div className="bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-xl">{children}</div>
      </div>
    </div>
  );
}
