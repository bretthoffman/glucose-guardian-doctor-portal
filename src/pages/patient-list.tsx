import { useState } from "react";
import { useLocation } from "wouter";
import { Activity, LogOut, ChevronRight, Building2, Lock, Search } from "lucide-react";
import { useSession } from "@/auth/use-session";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatTime, getGlucoseColor, calculateA1C } from "@/lib/utils";
import { useCurrentDoctor } from "@/auth/use-current-doctor";
import { useDoctorPatients, useLinkPatient, usePatientSnapshot } from "@/data/doctor-data";
import type { PatientFlag } from "@/data/contracts";
import type { LinkedPatient } from "@/data/linked-patients";
import type { PatientSnapshot } from "@doctor-portal/api-client-react";

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

function diabetesLabel(t?: string): string | undefined {
  if (t === "type1") return "Type 1";
  if (t === "type2") return "Type 2";
  return t ? "Other" : undefined;
}

function flagsFromSnapshot(s: PatientSnapshot): PatientFlag[] {
  const latest = s.glucoseReadings?.[0];
  if (!latest) return ["no_recent_data"];
  const v = latest.value;
  const a = s.alertPreferences;
  const flags: PatientFlag[] = [];
  if (a?.urgentHighThreshold && v >= a.urgentHighThreshold) flags.push("urgent_high");
  else if (a?.highThreshold && v > a.highThreshold) flags.push("high");
  if (a?.urgentLowThreshold && v <= a.urgentLowThreshold) flags.push("urgent_low");
  else if (a?.lowThreshold && v < a.lowThreshold) flags.push("low");
  return flags;
}

function PatientCard({ entry, onOpen }: { entry: LinkedPatient; onOpen: () => void }) {
  const { snapshot, isLoading, error } = usePatientSnapshot(entry.code);
  const profile = snapshot?.profile;
  const latest = snapshot?.glucoseReadings?.[0];
  const flags = snapshot ? flagsFromSnapshot(snapshot) : [];
  const a1c = snapshot?.glucoseReadings?.length ? calculateA1C(snapshot.glucoseReadings) : undefined;
  const dtype = diabetesLabel(profile?.diabetesType);
  const accent =
    flags.includes("urgent_low") || flags.includes("urgent_high")
      ? "border-l-4 border-l-destructive"
      : flags.includes("high") || flags.includes("low")
        ? "border-l-4 border-l-amber-500"
        : "";

  return (
    <button onClick={onOpen} className="w-full text-left">
      <Card className={`hover:border-primary/40 transition-colors ${accent}`}>
        <CardContent className="p-5 flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-foreground">{profile?.childName ?? entry.name}</span>
              {dtype && (
                <span className="text-xs px-2 py-0.5 rounded-full border border-border text-muted-foreground">
                  {dtype}
                </span>
              )}
              <span className="text-xs font-mono text-muted-foreground">{entry.code}</span>
              {flags.map((f) => (
                <FlagChip key={f} flag={f} />
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {isLoading
                ? "Loading…"
                : error
                  ? "Data locked — backend requires doctor sign-in"
                  : latest
                    ? `Last reading ${formatTime(latest.timestamp)}`
                    : "Pending sync — no data yet"}
              {a1c != null && ` · A1C ~${a1c}%`}
            </p>
          </div>
          {latest && (
            <span
              className={`text-sm font-semibold px-2.5 py-0.5 rounded-full ${getGlucoseColor(latest.value)}`}
            >
              {latest.value}
            </span>
          )}
          <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
        </CardContent>
      </Card>
    </button>
  );
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

  const q = query.trim().toLowerCase();
  const visible = patients.filter(
    (p) => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q),
  );

  async function handleLink(e: React.FormEvent) {
    e.preventDefault();
    setLinkMsg(null);
    try {
      const linked = await linkPatient(code.trim().toUpperCase());
      refetch();
      setLinkMsg(`Linked ${linked.name} — now in your list below.`);
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
            {patients.length === 0
              ? "Link a patient with the Doctor Code from their Glucose Guardian app."
              : `${patients.length} linked patient${patients.length === 1 ? "" : "s"}.`}
          </p>
        </section>

        <Card>
          <CardContent className="p-5">
            <form onSubmit={handleLink} className="flex flex-col sm:flex-row gap-3 sm:items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Link a patient by Doctor Code
                </label>
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="e.g. 7ZD36Z"
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

        {patients.length > 0 && (
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
          {patients.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border-2 border-dashed border-border rounded-xl">
              No linked patients yet. Enter a Doctor Code above to add one.
            </div>
          ) : visible.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No patients match &ldquo;{query}&rdquo;.
            </div>
          ) : (
            visible.map((entry) => (
              <PatientCard
                key={entry.code}
                entry={entry}
                onOpen={() => setLocation(`/patient/${entry.code}/overview`)}
              />
            ))
          )}
        </section>
      </main>
    </div>
  );
}
