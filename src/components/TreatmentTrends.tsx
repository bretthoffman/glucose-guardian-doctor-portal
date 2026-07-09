import { useMemo, useState } from "react";
import { ArrowRight, TrendingUp, History, ArrowDown, ArrowUp, Minus } from "lucide-react";
import type { CGMReading, PatientSnapshot } from "@doctor-portal/api-client-react";
import type { PatientDetail, SettingsChange } from "@/data/contracts";
import { computeMetrics, zonesFromSnapshot } from "@/lib/glucose-metrics";
import { GlucoseChart } from "@/components/GlucoseChart";
import { formatDate } from "@/lib/utils";

const DAY = 86_400_000;
const ts = (r: { timestamp: string }) => new Date(r.timestamp).getTime();

function ratioText(c: { carbRatio?: number; correctionFactor?: number; targetGlucose?: number }): string {
  const parts: string[] = [];
  if (c.carbRatio != null) parts.push(`carb 1:${c.carbRatio}`);
  if (c.correctionFactor != null) parts.push(`corr 1:${c.correctionFactor}`);
  if (c.targetGlucose != null) parts.push(`target ${c.targetGlucose}`);
  return parts.join(" · ") || "—";
}

/** The fields that changed between two settings entries, as "1:10 → 1:12" strings. */
function diffText(prev: SettingsChange | undefined, next: SettingsChange): string[] {
  const out: string[] = [];
  const rows: [string, number | undefined, number | undefined, string][] = [
    ["Carb ratio", prev?.carbRatio, next.carbRatio, "1:"],
    ["Correction", prev?.correctionFactor, next.correctionFactor, "1:"],
    ["Target", prev?.targetGlucose, next.targetGlucose, ""],
  ];
  for (const [label, a, b, pfx] of rows) {
    if (b != null && a !== b) out.push(`${label} ${a != null ? `${pfx}${a} → ` : ""}${pfx}${b}`);
  }
  return out;
}

interface Window {
  readings: CGMReading[];
  m: ReturnType<typeof computeMetrics>;
  from: number;
  to: number;
}

function windowFor(snapshot: PatientSnapshot, readings: CGMReading[], from: number, to: number): Window {
  const sub = readings.filter((r) => ts(r) >= from && ts(r) < to);
  return { readings: sub, m: computeMetrics({ ...snapshot, glucoseReadings: sub }), from, to };
}

function DeltaStat({
  label,
  before,
  after,
  unit,
  betterWhen,
  targetMid,
}: {
  label: string;
  before: number | null;
  after: number | null;
  unit: string;
  betterWhen: "higher" | "lower" | "toward";
  targetMid?: number;
}) {
  if (before == null || after == null) return null;
  const delta = after - before;
  let better: boolean | null = null;
  if (delta === 0) better = null;
  else if (betterWhen === "higher") better = delta > 0;
  else if (betterWhen === "lower") better = delta < 0;
  else if (betterWhen === "toward" && targetMid != null)
    better = Math.abs(after - targetMid) < Math.abs(before - targetMid);
  const color = better == null ? "text-muted-foreground" : better ? "text-success" : "text-destructive";
  const Arrow = delta === 0 ? Minus : delta > 0 ? ArrowUp : ArrowDown;
  return (
    <div className="rounded-xl border border-border bg-secondary/30 p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="flex items-baseline gap-2 mt-1">
        <span className="text-sm text-muted-foreground">
          {before}
          {unit}
        </span>
        <ArrowRight className="w-3 h-3 text-muted-foreground" />
        <span className="text-lg font-display font-bold text-foreground">
          {after}
          {unit}
        </span>
      </div>
      <div className={`flex items-center gap-1 text-xs mt-0.5 ${color}`}>
        <Arrow className="w-3 h-3" />
        {delta === 0 ? "No change" : `${delta > 0 ? "+" : ""}${delta}${unit}`}
      </div>
    </div>
  );
}

export function TreatmentTrends({ detail }: { detail: PatientDetail }) {
  const snapshot = detail.snapshot;
  const zones = zonesFromSnapshot(snapshot);
  const targetMid = Math.round((zones.low + zones.high) / 2);

  const readings = useMemo(
    () => [...(snapshot.glucoseReadings ?? [])].sort((a, b) => ts(a) - ts(b)),
    [snapshot.glucoseReadings],
  );
  const history = detail.settingsHistory ?? [];
  // Actual changes are entries after the seeded baseline (index 0).
  const changes = history.slice(1);

  // Pivot = a point in time to split "before" vs "after". Prefer real setting changes; fall back to
  // the midpoint of the available data so the comparison is always populated.
  const firstMs = readings.length ? ts(readings[0]) : 0;
  const lastMs = readings.length ? ts(readings[readings.length - 1]) : 0;
  const changePivots = useMemo(
    () =>
      changes
        .map((c, i) => ({ change: c, prev: history[i], ms: new Date(c.changedAt).getTime() }))
        .filter((p) => p.ms > firstMs && p.ms < lastMs),
    [changes, history, firstMs, lastMs],
  );

  const [pivotIdx, setPivotIdx] = useState<number>(changePivots.length - 1);
  const selected = changePivots[pivotIdx];
  const pivotMs = selected ? selected.ms : readings.length ? ts(readings[Math.floor(readings.length / 2)]) : 0;

  const comparison = useMemo(() => {
    if (readings.length < 4) return null;
    const span = Math.min(7 * DAY, Math.max(0, pivotMs - firstMs), Math.max(0, lastMs - pivotMs));
    if (span <= 0) return null;
    const before = windowFor(snapshot, readings, pivotMs - span, pivotMs);
    const after = windowFor(snapshot, readings, pivotMs, pivotMs + span);
    if (!before.readings.length || !after.readings.length) return null;
    return { before, after };
  }, [snapshot, readings, pivotMs, firstMs, lastMs]);

  const headline = useMemo(() => {
    if (!comparison) return null;
    const dTir = comparison.after.m.tir - comparison.before.m.tir;
    if (Math.abs(dTir) >= 3) {
      return `Time in range ${dTir > 0 ? "improved" : "dropped"} ${Math.abs(dTir)} points (${comparison.before.m.tir}% → ${comparison.after.m.tir}%) ${selected ? "after this change" : "in the more recent period"}.`;
    }
    const dAvg = (comparison.after.m.average ?? 0) - (comparison.before.m.average ?? 0);
    if (Math.abs(dAvg) >= 8) {
      return `Average glucose ${dAvg < 0 ? "fell" : "rose"} ${Math.abs(dAvg)} mg/dL (${comparison.before.m.average} → ${comparison.after.m.average}).`;
    }
    return "No major change in trends between these two periods.";
  }, [comparison, selected]);

  const rangeLabel = (w: Window) => `${formatDate(new Date(w.from).toISOString())} – ${formatDate(new Date(w.to).toISOString())}`;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-display font-bold text-foreground">Change history & trend impact</h3>
      </div>

      {/* History timeline */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <History className="w-4 h-4 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">Settings history</p>
        </div>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No setting changes recorded yet. Once the carb ratio, correction factor, or target
            changes, each change is logged here and you can compare glucose trends before and after.
          </p>
        ) : (
          <ol className="space-y-2">
            {history
              .map((c, i) => ({ c, i }))
              .reverse()
              .map(({ c, i }) => {
                const changed = i === 0 ? ["Initial settings"] : diffText(history[i - 1], c);
                const isCurrent = i === history.length - 1;
                return (
                  <li key={`${c.changedAt}-${i}`} className="flex items-start gap-3">
                    <span
                      className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${isCurrent ? "bg-primary" : "bg-border"}`}
                    />
                    <div className="min-w-0">
                      <p className="text-sm text-foreground">
                        {changed.join(" · ")}
                        {isCurrent && (
                          <span className="ml-2 text-[10px] uppercase tracking-wide text-primary">
                            Current
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(c.changedAt)} · {ratioText(c)}
                      </p>
                    </div>
                  </li>
                );
              })}
          </ol>
        )}
      </div>

      {/* Comparison */}
      {!comparison ? (
        <div className="rounded-2xl border border-border bg-secondary/30 p-4 text-sm text-muted-foreground">
          Not enough glucose history yet to compare periods. As more CGM data syncs, a before/after
          comparison will appear here.
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium text-foreground">Before vs after</p>
            {changePivots.length > 0 && (
              <select
                value={pivotIdx}
                onChange={(e) => setPivotIdx(Number(e.target.value))}
                className="text-xs bg-secondary border border-border rounded-lg px-2 py-1 text-foreground"
              >
                {changePivots.map((p, i) => (
                  <option key={i} value={i}>
                    {formatDate(p.change.changedAt)} · {(diffText(p.prev, p.change)[0] ?? ratioText(p.change))}
                  </option>
                ))}
              </select>
            )}
          </div>

          {headline && (
            <div className="rounded-xl border border-primary/30 bg-primary/10 p-3 text-sm text-foreground">
              {headline}
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <DeltaStat label="Time in range" before={comparison.before.m.tir} after={comparison.after.m.tir} unit="%" betterWhen="higher" />
            <DeltaStat label="Avg glucose" before={comparison.before.m.average} after={comparison.after.m.average} unit="" betterWhen="toward" targetMid={targetMid} />
            <DeltaStat label="Time high" before={comparison.before.m.tar} after={comparison.after.m.tar} unit="%" betterWhen="lower" />
            <DeltaStat label="Time low" before={comparison.before.m.tbr} after={comparison.after.m.tbr} unit="%" betterWhen="lower" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[comparison.before, comparison.after].map((w, i) => (
              <div key={i}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-medium text-foreground">{i === 0 ? "Before" : "After"}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {rangeLabel(w)} · TIR {w.m.tir}%
                  </p>
                </div>
                <GlucoseChart readings={w.readings} zones={zones} height={180} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
