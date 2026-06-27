import { AlertTriangle, Clock, RefreshCw } from "lucide-react";
import type { PatientSnapshot } from "@doctor-portal/api-client-react";
import { formatDate, formatTime } from "@/lib/utils";
import { computeMetrics, formatAge, STATUS_META, TREND_LABEL } from "@/lib/glucose-metrics";

function initials(name: string): string {
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

function MetaStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground truncate">{value}</p>
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
  const m = computeMetrics(snapshot);
  const urgent = !m.stale && (m.status === "urgentHigh" || m.status === "urgentLow");
  const meta = m.status ? STATUS_META[m.status] : null;

  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-12 h-12 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center text-primary font-display font-bold shrink-0">
            {initials(p.childName)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-display font-bold text-foreground">{p.childName}</h1>
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30">
                {typeLabel(p.diabetesType)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {p.dateOfBirth ? `DOB ${formatDate(p.dateOfBirth)}` : "DOB —"}
              {p.parentName ? ` · Caregiver: ${p.parentName}` : ""}
              {` · ID ${snapshot.accessCode}`}
            </p>
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
            value={m.latest ? formatTime(m.latest.timestamp) : "—"}
          />
          <MetaStat
            label="Last Insulin"
            value={m.lastInsulin ? `${m.lastInsulin.units}u · ${formatTime(m.lastInsulin.timestamp)}` : "—"}
          />
          <MetaStat
            label="Last Meal Entry"
            value={m.lastMeal ? formatTime(m.lastMeal.timestamp) : "—"}
          />
        </div>
      </div>
    </div>
  );
}
