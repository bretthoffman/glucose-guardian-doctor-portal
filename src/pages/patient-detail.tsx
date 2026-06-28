import { useLocation } from "wouter";
import {
  LayoutDashboard,
  LineChart,
  Syringe,
  SlidersHorizontal,
  MessageSquare,
  LogOut,
  Lock,
  Activity,
  ChevronsUpDown,
  ArrowLeft,
  ArrowLeftRight,
  ArrowUp,
  ArrowDown,
  ArrowUpRight,
  ArrowDownRight,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingScreen } from "@/components/LoadingScreen";
import { PatientHeader } from "@/components/PatientHeader";
import { computeMetrics, STATUS_META, formatAge } from "@/lib/glucose-metrics";
import { OverviewPanel } from "@/components/panels/OverviewPanel";
import { ChartPanel } from "@/components/panels/ChartPanel";
import { InsulinPanel } from "@/components/panels/InsulinPanel";
import { TherapyOrdersPanel } from "@/components/panels/TherapyOrdersPanel";
import { MessagesPanel } from "@/components/panels/MessagesPanel";
import { useSession } from "@/auth/use-session";
import { useCurrentDoctor } from "@/auth/use-current-doctor";
import { usePatientDetail } from "@/data/doctor-data";

// `inNav: false` tabs are still valid routes (reached from Overview cards) but hidden from the
// sidebar — the three lookalike pages collapse into one Overview home. Flip these back to true
// to restore them in the nav.
const TABS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard, inNav: true },
  { id: "chart", label: "CGM / A1C Trends", icon: LineChart, inNav: false },
  { id: "insulin", label: "Insulin Log", icon: Syringe, inNav: false },
  { id: "orders", label: "Treatment Settings", icon: SlidersHorizontal, inNav: true },
  { id: "messages", label: "Messages", icon: MessageSquare, inNav: true },
];
const DRILL_DOWN = ["chart", "insulin"];

function initials(name?: string): string {
  if (!name) return "?";
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

function typeLabel(t?: string): string {
  return t === "type1" ? "Type 1" : t === "type2" ? "Type 2" : "Other";
}

function TrendArrow({ trend, className = "w-4 h-4" }: { trend: string; className?: string }) {
  switch (trend) {
    case "DoubleUp":
    case "SingleUp":
      return <ArrowUp className={className} />;
    case "FortyFiveUp":
      return <ArrowUpRight className={className} />;
    case "FortyFiveDown":
      return <ArrowDownRight className={className} />;
    case "SingleDown":
    case "DoubleDown":
      return <ArrowDown className={className} />;
    default:
      return <ArrowRight className={className} />;
  }
}

export function PatientDetail({ accessCode, tab }: { accessCode: string; tab: string }) {
  const [, setLocation] = useLocation();
  const { signOut, lock, canLock } = useSession();
  const access = useCurrentDoctor();
  const doctor = access.status === "active" ? access.doctor : undefined;
  const { data: detail, isLoading, isFetching, refetch } = usePatientDetail(accessCode);
  const current = TABS.some((t) => t.id === tab) ? tab : "overview";

  if (isLoading) return <LoadingScreen message="Loading patient…" />;
  if (!detail) return <NotLinked accessCode={accessCode} onBack={() => setLocation("/")} />;

  const name = detail.snapshot.profile.childName;
  const gm = computeMetrics(detail.snapshot);
  const gstatus = gm.status ? STATUS_META[gm.status] : null;

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <aside className="w-64 bg-card border-r border-border flex flex-col shrink-0">
        <div className="p-4 flex items-center gap-2.5 border-b border-border/60">
          <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center shadow-lg shadow-primary/20">
            <Activity className="w-5 h-5 text-primary-foreground" />
          </div>
          <div className="leading-tight">
            <p className="font-display font-bold text-foreground">GlucoGuardian</p>
            <p className="text-[11px] text-muted-foreground">Diabetes Care Portal</p>
          </div>
        </div>

        <div className="p-3 border-b border-border/60">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground px-1 mb-1.5">
            Patient
          </p>
          <button
            onClick={() => setLocation("/")}
            title="Switch patient"
            className="w-full flex items-center gap-2.5 p-2 rounded-xl border border-border hover:bg-secondary/50 transition-colors text-left"
          >
            <div className="w-8 h-8 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center text-primary text-xs font-bold shrink-0">
              {initials(name)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground truncate">{name}</p>
              <p className="text-[11px] text-muted-foreground truncate">
                {typeLabel(detail.snapshot.profile.diabetesType)} · {detail.accessCode}
              </p>
            </div>
            <ChevronsUpDown className="w-4 h-4 text-muted-foreground shrink-0" />
          </button>

          <div
            className={`mt-2 rounded-xl border px-3 py-2 ${
              gm.latest && !gm.stale && gstatus ? gstatus.chip : "border-border bg-secondary/30"
            }`}
          >
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {gm.stale ? "Last Glucose" : "Current Glucose"}
              </p>
              {gm.latest && gm.minutesSinceLatest != null && (
                <span className="text-[10px] text-muted-foreground">
                  {formatAge(gm.minutesSinceLatest)}
                </span>
              )}
            </div>
            {gm.latest ? (
              <div className="flex items-center gap-1.5 mt-0.5">
                <span
                  className={`text-xl font-display font-bold ${
                    gm.stale ? "text-muted-foreground" : (gstatus?.text ?? "text-foreground")
                  }`}
                >
                  {gm.latest.value}
                </span>
                <span className="text-[11px] text-muted-foreground">mg/dL</span>
                <span className={`ml-auto ${gm.stale ? "text-muted-foreground" : gstatus?.text}`}>
                  <TrendArrow trend={gm.latest.trend} className="w-4 h-4" />
                </span>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground mt-0.5">No CGM data</p>
            )}
          </div>

          <button
            onClick={() => setLocation("/")}
            className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <ArrowLeftRight className="w-4 h-4" /> Switch Patient
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {TABS.filter((t) => t.inNav).map((item) => {
            const Icon = item.icon;
            const isActive =
              current === item.id || (item.id === "overview" && DRILL_DOWN.includes(current));
            return (
              <button
                key={item.id}
                onClick={() => setLocation(`/patient/${detail.accessCode}/${item.id}`)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground border border-transparent"
                }`}
              >
                <Icon className={`w-[18px] h-[18px] ${isActive ? "text-primary" : "opacity-70"}`} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-border space-y-1">
          {doctor && (
            <div className="flex items-center gap-2.5 px-2 py-2">
              <div className="w-8 h-8 rounded-full bg-secondary border border-border flex items-center justify-center text-xs font-bold text-foreground shrink-0">
                {initials(doctor.displayName)}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{doctor.displayName}</p>
                <p className="text-[11px] text-muted-foreground truncate">{doctor.email}</p>
              </div>
            </div>
          )}
          {canLock && (
            <button
              onClick={lock}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            >
              <Lock className="w-[18px] h-[18px] opacity-70" /> Lock
            </button>
          )}
          <button
            onClick={signOut}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
          >
            <LogOut className="w-[18px] h-[18px] opacity-70" /> Sign Out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-background">
        <div className="max-w-[1600px] mx-auto p-5 lg:p-6 space-y-5">
          {DRILL_DOWN.includes(current) && (
            <button
              onClick={() => setLocation(`/patient/${detail.accessCode}/overview`)}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Overview
            </button>
          )}
          <PatientHeader snapshot={detail.snapshot} onRefresh={refetch} refreshing={isFetching} />
          <div key={current} className="animate-fade-in">
            {current === "overview" && (
              <OverviewPanel data={detail.snapshot} accessCode={detail.accessCode} />
            )}
            {current === "chart" && <ChartPanel data={detail.snapshot} />}
            {current === "insulin" && (
              <InsulinPanel data={detail.snapshot} accessCode={detail.accessCode} />
            )}
            {current === "orders" && <TherapyOrdersPanel detail={detail} />}
            {current === "messages" && (
              <MessagesPanel accessCode={detail.accessCode} patientName={name} />
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
