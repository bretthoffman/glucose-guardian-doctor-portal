import { AlertTriangle, Cake, Clock, IdCard, Phone, RefreshCw, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { PatientSnapshot } from "@doctor-portal/api-client-react";
import { formatDate, formatTime } from "@/lib/utils";
import { computeMetrics, formatAge, isToday, STATUS_META, TREND_LABEL } from "@/lib/glucose-metrics";
import { PatientAvatar } from "@/components/PatientAvatar";

/** Time for today's events, but a date once they're older — so a stale entry never reads as "now". */
function stamp(ts: string): string {
  return isToday(ts) ? formatTime(ts) : formatDate(ts);
}

function typeLabel(t?: string): string {
  return t === "type1" ? "Type 1" : t === "type2" ? "Type 2" : "Other";
}

/** Age from a date-of-birth ISO string, in years (or months under a year). */
function ageLabel(dob?: string): string | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let years = now.getFullYear() - d.getFullYear();
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) {
    years--;
  }
  if (years < 0) return null;
  if (years >= 1) return `${years} yr${years === 1 ? "" : "s"}`;
  let months = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
  if (now.getDate() < d.getDate()) months--;
  months = Math.max(0, months);
  return `${months} mo`;
}

function MetaStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground truncate">{value}</p>
    </div>
  );
}

/** A labeled identity fact with an icon (DOB, caregiver, ID). */
function MetaItem({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-2 min-w-0">
      <Icon className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground leading-none">
          {label}
        </p>
        <p className={`text-sm font-medium text-foreground leading-tight mt-1 truncate ${mono ? "font-mono" : ""}`}>
          {value}
        </p>
      </div>
    </div>
  );
}

export function PatientHeader({
  snapshot,
  onRefresh,
  refreshing,
}: {
  snapshot: PatientSnapshot;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  const p = snapshot.profile;
  const age = ageLabel(p.dateOfBirth);
  const syncMins = snapshot.syncedAt
    ? Math.max(0, Math.round((Date.now() - new Date(snapshot.syncedAt).getTime()) / 60000))
    : null;
  const m = computeMetrics(snapshot);
  const urgent = !m.stale && (m.status === "urgentHigh" || m.status === "urgentLow");
  const meta = m.status ? STATUS_META[m.status] : null;

  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <PatientAvatar
            name={p.childName}
            photoDataUri={p.photoDataUri}
            className="w-14 h-14 text-lg"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-display font-bold text-foreground">{p.childName}</h1>
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30">
                {typeLabel(p.diabetesType)}
              </span>
            </div>
            <div className="flex flex-wrap items-start gap-x-6 gap-y-2 mt-3">
              <MetaItem
                icon={Cake}
                label="Date of birth"
                value={
                  p.dateOfBirth
                    ? `${formatDate(p.dateOfBirth)}${age ? ` · ${age}` : ""}`
                    : "—"
                }
              />
              {p.parentName && <MetaItem icon={User} label="Caregiver" value={p.parentName} />}
              {p.caregiverPhone && (
                <MetaItem icon={Phone} label="Phone" value={p.caregiverPhone} />
              )}
              <MetaItem icon={IdCard} label="Patient ID" value={snapshot.accessCode} mono />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
          <span
            className={`w-1.5 h-1.5 rounded-full ${m.stale ? "bg-amber-500" : "bg-success"}`}
          />
          {m.latest && m.minutesSinceLatest != null
            ? `Updated ${formatAge(m.minutesSinceLatest)}`
            : "No CGM data"}
          <button
            onClick={onRefresh}
            disabled={refreshing}
            title="Refresh patient data"
            aria-label="Refresh patient data"
            className="ml-1 rounded-md p-1 hover:bg-secondary hover:text-foreground transition-colors disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="flex items-stretch gap-4 mt-4 flex-wrap">
        {m.stale && m.latest && m.minutesSinceLatest != null ? (
          <div className="flex-1 min-w-[240px] rounded-xl border px-4 py-3 flex items-center gap-3 bg-amber-500/10 text-amber-600 border-amber-500/30">
            <Clock className="w-5 h-5 shrink-0" />
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide">Data may be outdated</p>
              <p className="text-xs opacity-90">
                Last CGM reading {formatAge(m.minutesSinceLatest)} ({formatTime(m.latest.timestamp)})
                · may not reflect current glucose
              </p>
            </div>
          </div>
        ) : urgent && meta ? (
          <div
            className={`flex-1 min-w-[240px] rounded-xl border px-4 py-3 flex items-center gap-3 ${meta.chip}`}
          >
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide">{meta.label}</p>
              <p className="text-xs opacity-90">
                Glucose is {m.latest?.value} mg/dL · Trend{" "}
                {TREND_LABEL[m.latest?.trend ?? "Flat"] ?? "Flat"}
              </p>
            </div>
          </div>
        ) : null}
        <div className="flex items-center gap-6 rounded-xl border border-border bg-secondary/30 px-4 py-3 ml-auto flex-wrap">
          <MetaStat
            label="Last CGM Reading"
            value={m.latest ? stamp(m.latest.timestamp) : "—"}
          />
          <MetaStat
            label="Last Insulin"
            value={m.lastInsulin ? `${m.lastInsulin.units}u · ${stamp(m.lastInsulin.timestamp)}` : "—"}
          />
          <MetaStat
            label="Last Meal Entry"
            value={m.lastMeal ? stamp(m.lastMeal.timestamp) : "—"}
          />
        </div>

        {/* Meals & insulin only reach the portal when the app syncs; make staleness explicit so an
            old entry is never mistaken for current activity. */}
        {syncMins != null && syncMins > 180 && (
          <p className="w-full text-xs text-amber-600/90 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 shrink-0" />
            Meals &amp; insulin last synced from the app {formatAge(syncMins)} — newer entries in the
            app won't appear until it syncs again. (Glucose updates continuously.)
          </p>
        )}
      </div>
    </div>
  );
}
