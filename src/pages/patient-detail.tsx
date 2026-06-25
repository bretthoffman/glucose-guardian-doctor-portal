import { useLocation } from "wouter";
import { useSession } from "@/auth/use-session";
import {
  ArrowLeft,
  LayoutDashboard,
  LineChart,
  Syringe,
  Sliders,
  MessageCircle,
  LogOut,
  Activity,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingScreen } from "@/components/LoadingScreen";
import { OverviewPanel } from "@/components/panels/OverviewPanel";
import { ChartPanel } from "@/components/panels/ChartPanel";
import { InsulinPanel } from "@/components/panels/InsulinPanel";
import { TherapyOrdersPanel } from "@/components/panels/TherapyOrdersPanel";
import { MessagesView } from "@/components/panels/MessagesView";
import { usePatientDetail } from "@/data/doctor-data";

const TABS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "chart", label: "CGM Chart", icon: LineChart },
  { id: "insulin", label: "Insulin Log", icon: Syringe },
  { id: "orders", label: "Treatment Settings", icon: Sliders },
  { id: "messages", label: "Messages", icon: MessageCircle },
];

export function PatientDetail({ accessCode, tab }: { accessCode: string; tab: string }) {
  const [, setLocation] = useLocation();
  const { signOut, lock, canLock } = useSession();
  const { data: detail, isLoading } = usePatientDetail(accessCode);
  const current = TABS.some((t) => t.id === tab) ? tab : "overview";

  if (isLoading) return <LoadingScreen message="Loading patient…" />;
  if (!detail) return <NotLinked accessCode={accessCode} onBack={() => setLocation("/")} />;

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <aside className="w-64 bg-card border-r border-border flex flex-col shrink-0">
        <div className="p-4 border-b border-border/50">
          <button
            onClick={() => setLocation("/")}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> All patients
          </button>
        </div>
        <div className="p-4 border-b border-border/50 bg-secondary/20">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            Patient
          </p>
          <p className="font-medium text-foreground truncate">{detail.snapshot.profile.childName}</p>
          <p className="text-xs text-muted-foreground font-mono mt-0.5">{detail.accessCode}</p>
        </div>
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          {TABS.map((item) => {
            const Icon = item.icon;
            const isActive = current === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setLocation(`/patient/${detail.accessCode}/${item.id}`)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition-all ${
                  isActive
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground border border-transparent"
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? "text-primary" : "opacity-70"}`} />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="p-4 border-t border-border mt-auto space-y-1">
          {canLock && (
            <button
              onClick={lock}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            >
              <Lock className="w-5 h-5 opacity-70" /> Lock
            </button>
          )}
          <button
            onClick={signOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
          >
            <LogOut className="w-5 h-5 opacity-70" /> Sign Out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-background">
        <div className="max-w-6xl mx-auto p-6 lg:p-8">
          <div key={current} className="animate-fade-in">
            {current === "overview" && <OverviewPanel data={detail.snapshot} />}
            {current === "chart" && <ChartPanel data={detail.snapshot} />}
            {current === "insulin" && <InsulinPanel data={detail.snapshot} />}
            {current === "orders" && <TherapyOrdersPanel detail={detail} />}
            {current === "messages" && (
              <MessagesView
                accessCode={detail.accessCode}
                patientName={detail.snapshot.profile.childName}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function NotLinked({ accessCode, onBack }: { accessCode: string; onBack: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md text-center bg-card border border-border rounded-2xl p-8 shadow-xl">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <Activity className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2">Patient not found</h2>
        <p className="text-muted-foreground text-sm mb-6">
          No linked patient matches access code{" "}
          <span className="font-mono text-foreground">{accessCode}</span>. It may not be linked to
          your account.
        </p>
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to patients
        </Button>
      </div>
    </div>
  );
}
