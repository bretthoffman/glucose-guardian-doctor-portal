import { useState } from "react";
import { useLocation } from "wouter";
import { Activity, LogOut, ChevronRight, Building2, Lock, Search } from "lucide-react";
import { useSession } from "@/auth/use-session";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatTime, getGlucoseColor } from "@/lib/utils";
import { useCurrentDoctor } from "@/auth/use-current-doctor";
import { useDoctorPatients, useLinkPatient } from "@/data/doctor-data";
import type { PatientFlag } from "@/data/contracts";

const FLAG_META: Record<PatientFlag, { label: string; className: string }> = {
  urgent_low: { label: "Urgent low", className: "bg-destructive/15 text-destructive border-destructive/30" },
  low: { label: "Low", className: "bg-orange-500/15 text-orange-600 border-orange-500/30" },
  high: { label: "High", className: "bg-amber-500/15 text-amber-600 border-amber-500/30" },
  urgent_high: { label: "Urgent high", className: "bg-destructive/15 text-destructive border-destructive/30" },
  no_recent_data: { label: "No recent data", className: "bg-secondary text-muted-foreground border-border" },
  pending_order: { label: "Order pending", className: "bg-primary/15 text-primary border-primary/30" },
};

function FlagChip({ flag }: { flag: PatientFlag }) {
  const meta = FLAG_META[flag];
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border ${meta.className}`}>{meta.label}</span>
  );
}

// Clinical triage priority: lower sorts first. Urgent highs/lows lead, then out-of-range,
// then informational (pending order, stale data), then in-range.
const FLAG_PRIORITY: Record<PatientFlag, number> = {
  urgent_low: 0,
  urgent_high: 0,
  low: 1,
  high: 1,
  pending_order: 2,
  no_recent_data: 3,
};
const ATTENTION_FLAGS: PatientFlag[] = ["urgent_low", "urgent_high", "low", "high"];

function patientPriority(flags: PatientFlag[]): number {
  return flags.length ? Math.min(...flags.map((f) => FLAG_PRIORITY[f])) : 5;
}
function needsAttention(flags: PatientFlag[]): boolean {
  return flags.some((f) => ATTENTION_FLAGS.includes(f));
}

function diabetesLabel(t?: string): string | undefined {
  if (t === "type1") return "Type 1";
  if (t === "type2") return "Type 2";
  return t ? "Other" : undefined;
}

export function PatientList() {
  const [, setLocation] = useLocation();
  const { signOut, lock, canLock } = useSession();
  const access = useCurrentDoctor();
  const doctor = access.status === "active" ? access.doctor : undefined;
  const org = access.status === "active" ? access.organization : undefined;

  const { data: patients, refetch } = useDoctorPatients();
  const { mutate: linkPatient, isPending } = useLinkPatient();
  const [code, setCode] = useState("");
  const [linkMsg, setLinkMsg] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const sorted = patients
    ? [...patients].sort((a, b) => patientPriority(a.flags) - patientPriority(b.flags))
    : undefined;
  const attentionCount = patients?.filter((p) => needsAttention(p.flags)).length ?? 0;
  const q = query.trim().toLowerCase();
  const visible = sorted?.filter((p) => p.displayName.toLowerCase().includes(q));

  async function handleLink(e: React.FormEvent) {
    e.preventDefault();
    setLinkMsg(null);
    try {
      const linked = await linkPatient(code.trim().toUpperCase());
      refetch();
      setLinkMsg(`Linked ${linked.displayName} — now in your list below.`);
      setCode("");
    } catch (err) {
      setLinkMsg(err instanceof Error ? err.message : "Could not link patient.");
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center shadow-lg shadow-primary/20">
              <Activity className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <p className="font-display font-bold text-foreground leading-tight">Gluco Guardian</p>
              {org && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Building2 className="w-3 h-3" /> {org.name}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
            {doctor && (
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-foreground leading-tight">{doctor.displayName}</p>
                <p className="text-xs text-muted-foreground">{doctor.specialty}</p>
              </div>
            )}
            {canLock && (
              <Button variant="ghost" size="sm" onClick={lock}>
                <Lock className="w-4 h-4 mr-2" /> Lock
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={signOut}>
              <LogOut className="w-4 h-4 mr-2" /> Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        <section>
          <h1 className="text-2xl font-display font-bold text-foreground mb-1">Your patients</h1>
          <p className="text-muted-foreground text-sm">
            {patients === undefined
              ? "Patients who have linked their Gluco Guardian app to your care."
              : attentionCount > 0
                ? `${attentionCount} of ${patients.length} need attention — shown first.`
                : `All ${patients.length} patients in range.`}
          </p>
        </section>

        <Card>
          <CardContent className="p-5">
            <form onSubmit={handleLink} className="flex flex-col sm:flex-row gap-3 sm:items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Link a patient by access code
                </label>
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="e.g. EMMA01"
                  className="uppercase tracking-widest"
                  autoComplete="off"
                />
              </div>
              <Button type="submit" disabled={!code.trim() || isPending}>
                {isPending ? "Linking…" : "Link patient"}
              </Button>
            </form>
            {linkMsg && <p className="text-sm text-muted-foreground mt-3">{linkMsg}</p>}
          </CardContent>
        </Card>

        {patients && patients.length > 0 && (
          <div className="relative">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search patients by name…"
              className="pl-9"
            />
          </div>
        )}

        <section className="space-y-3">
          {patients === undefined ? (
            <div className="text-center py-12 text-muted-foreground">Loading patients…</div>
          ) : patients.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border-2 border-dashed border-border rounded-xl">
              No linked patients yet. Use the form above to link a patient by access code.
            </div>
          ) : visible!.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No patients match &ldquo;{query}&rdquo;.
            </div>
          ) : (
            visible!.map((p) => (
              <button
                key={p.patientId}
                onClick={() => setLocation(`/patient/${p.accessCode}/overview`)}
                className="w-full text-left"
              >
                <Card
                  className={`hover:border-primary/40 transition-colors ${
                    patientPriority(p.flags) === 0
                      ? "border-l-4 border-l-destructive"
                      : patientPriority(p.flags) === 1
                        ? "border-l-4 border-l-amber-500"
                        : ""
                  }`}
                >
                  <CardContent className="p-5 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-foreground">{p.displayName}</span>
                        {diabetesLabel(p.diabetesType) && (
                          <span className="text-xs px-2 py-0.5 rounded-full border border-border text-muted-foreground">
                            {diabetesLabel(p.diabetesType)}
                          </span>
                        )}
                        <span className="text-xs font-mono text-muted-foreground">{p.accessCode}</span>
                        {p.flags.map((f) => (
                          <FlagChip key={f} flag={f} />
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {p.hasData && p.lastReadingAt
                          ? `Last reading ${formatTime(p.lastReadingAt)}`
                          : "Pending sync — no data yet"}
                        {p.a1cEstimate != null && ` · A1C ~${p.a1cEstimate}%`}
                      </p>
                    </div>
                    {p.hasData && p.lastReadingValue != null && (
                      <span
                        className={`text-sm font-semibold px-2.5 py-0.5 rounded-full ${getGlucoseColor(p.lastReadingValue)}`}
                      >
                        {p.lastReadingValue}
                      </span>
                    )}
                    <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
                  </CardContent>
                </Card>
              </button>
            ))
          )}
        </section>
      </main>
    </div>
  );
}
