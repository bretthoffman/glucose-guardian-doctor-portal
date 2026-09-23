import { useMemo } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Camera, Minus, Utensils } from "lucide-react";
import type { FoodLogEntry, PatientSnapshot } from "@doctor-portal/api-client-react";
import { SLOT_LABEL, type DayMeal, type DayReview } from "@/lib/day-review";
import { glucoseStatus, STATUS_META } from "@/lib/glucose-metrics";
import { useGlucoseHistory } from "@/data/doctor-data";
import { DayTimelineChart } from "@/components/DayTimelineChart";
import { formatTime } from "@/lib/utils";
import {
  AFTER_MARK_MIN,
  AFTER_TOLERANCE_MIN,
  BEFORE_WINDOW_MIN,
  describeOffset,
  readingAfter,
  readingBefore,
  readingNearMark,
  type EventReading,
} from "@/lib/meal-glucose";
import { WhoLogged } from "@/components/CaregiverName";

const MIN = 60_000;
const ms = (t: string) => new Date(t).getTime();

function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-secondary/30 p-3 min-w-0">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="text-lg font-display font-bold text-foreground leading-tight mt-0.5">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-0.5 break-words">{sub}</div>}
    </div>
  );
}

function AfterCell({
  label,
  reading,
  delta,
  zones,
}: {
  label: string;
  reading: EventReading | null;
  delta: number | null;
  zones: DayReview["zones"];
}) {
  const value = reading?.value ?? null;
  const meta = value != null ? STATUS_META[glucoseStatus(value, zones)] : null;
  const Arrow = delta == null || delta === 0 ? Minus : delta > 0 ? ArrowUp : ArrowDown;
  return (
    <div className="px-3 py-1 text-center border-l border-border/60 first:border-l-0 min-w-0">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className={`text-lg font-display font-bold leading-tight ${meta?.text ?? "text-muted-foreground"}`}>
        {value != null ? value : "—"}
        {value != null && <span className="text-[10px] font-normal text-muted-foreground ml-0.5">mg/dL</span>}
      </p>
      {value != null && delta != null ? (
        <p
          className={`text-[11px] flex items-center justify-center gap-0.5 ${
            delta > 0 ? "text-warning" : delta < 0 ? "text-success" : "text-muted-foreground"
          }`}
        >
          <Arrow className="w-3 h-3" />
          {delta === 0 ? "+0" : `${delta > 0 ? "+" : "−"}${Math.abs(delta)}`}
        </p>
      ) : (
        <p className="text-[11px] text-muted-foreground">—</p>
      )}
      <p className="text-[10px] text-muted-foreground">
        {reading ? `at ${formatTime(reading.timestamp)}` : "no reading"}
      </p>
    </div>
  );
}

/**
 * "Selected Meal" view for the Daily Review: replaces the Glucose & Insulin Timeline card when a
 * meal is clicked. Full meal info + the glucose response at 15/30/60 min, and the timeline zoomed
 * to the window around the meal. Readings come from the full-history store so the response works
 * for any meal, not just those in the ~1-day sync snapshot.
 */
export function MealResponsePanel({
  meal,
  food,
  snapshot,
  review,
  onBack,
}: {
  meal: DayMeal;
  food?: FoodLogEntry;
  snapshot: PatientSnapshot;
  review: DayReview;
  onBack: () => void;
}) {
  const t = ms(meal.timestamp);
  const afterWindowEnd = t + (AFTER_MARK_MIN + AFTER_TOLERANCE_MIN) * MIN;
  const hist = useGlucoseHistory(snapshot.accessCode, t - 60 * MIN, afterWindowEnd);

  const readings = useMemo(() => {
    if (hist.readings?.length) return hist.readings;
    return (review.readings ?? []).filter((r) => {
      const rt = ms(r.timestamp);
      return rt >= t - 60 * MIN && rt <= afterWindowEnd;
    });
  }, [hist.readings, review.readings, t, afterWindowEnd]);

  const pre = readingBefore(readings, t);
  const at15 = readingNearMark(readings, t, 15, 12);
  const at30 = readingNearMark(readings, t, 30, 12);
  const at60 = readingNearMark(readings, t, 60, 12);
  const after2h = readingAfter(readings, t);
  const d = (r: EventReading | null) => (r && pre ? r.value - pre.value : null);

  const after = [at15, at30, at60].filter((r): r is EventReading => r != null).map((r) => r.value);
  const peak = after.length ? Math.max(...after) : null;
  const change = pre && peak != null ? peak - pre.value : null;

  // Correction dose given around this meal (15 min before → 60 min after).
  const correction = useMemo(() => {
    const logs = snapshot.insulinLog ?? [];
    const sum = logs
      .filter((l) => l.type === "correction")
      .filter((l) => {
        const lt = ms(l.timestamp);
        return lt >= t - 15 * MIN && lt <= t + 60 * MIN;
      })
      .reduce((a, l) => a + l.units, 0);
    return sum > 0 ? Math.round(sum * 10) / 10 : null;
  }, [snapshot.insulinLog, t]);

  // Time in range across the hour after the meal.
  const tir = useMemo(() => {
    const inWin = readings.filter((r) => {
      const rt = ms(r.timestamp);
      return rt >= t && rt <= t + 60 * MIN;
    });
    if (!inWin.length) return null;
    const z = review.zones;
    const inR = inWin.filter((r) => r.value >= z.low && r.value <= z.high).length;
    const above = inWin.filter((r) => r.value > z.high).length;
    const below = inWin.filter((r) => r.value < z.low).length;
    return {
      pct: Math.round((inR / inWin.length) * 100),
      above: Math.round((above / inWin.length) * 100),
      below: Math.round((below / inWin.length) * 100),
    };
  }, [readings, t, review.zones]);

  const domain: [number, number] = [t - 45 * MIN, t + (AFTER_MARK_MIN + 15) * MIN];
  const markers = useMemo(
    () => (review.markers ?? []).filter((m) => m.ts >= domain[0] && m.ts <= domain[1]),
    [review.markers, domain[0], domain[1]],
  );
  const photo = food?.photoDataUri?.startsWith("data:image/") ? food.photoDataUri : null;

  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
        <div className="flex items-start gap-3 min-w-0">
          {photo ? (
            <img
              src={photo}
              alt={meal.name}
              className="w-12 h-12 rounded-xl object-cover border border-border shrink-0"
            />
          ) : (
            <span className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
              <Utensils className="w-4 h-4 text-primary" />
            </span>
          )}
          <div className="min-w-0">
            <h3 className="font-medium text-foreground">
              Selected Meal: <span className="text-primary">{SLOT_LABEL[meal.slot]}</span>
              <span className="text-sm font-normal text-muted-foreground ml-2">
                {formatTime(meal.timestamp)}
              </span>
            </h3>
            <p className="text-sm text-foreground mt-0.5 break-words">
              {meal.name}
              {meal.fromPhoto && !photo && (
                <Camera className="w-3.5 h-3.5 text-muted-foreground inline ml-1.5 -mt-0.5" />
              )}
            </p>
          </div>
        </div>
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors shrink-0"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Timeline
        </button>
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-2 2xl:grid-cols-4 gap-3">
        <Stat
          label="Carbs"
          value={
            <>
              {meal.carbs}
              <span className="text-xs font-normal text-muted-foreground ml-0.5">g</span>
            </>
          }
          sub={food?.confidence ? `${food.confidence} confidence` : undefined}
        />
        <Stat
          label="Insulin given"
          value={
            meal.units != null ? (
              <>
                {meal.units}
                <span className="text-xs font-normal text-muted-foreground ml-0.5">u</span>
              </>
            ) : (
              <span className="text-muted-foreground text-sm">none</span>
            )
          }
          sub={
            meal.manualOverride && meal.recommendedUnits != null
              ? `rec ${meal.recommendedUnits}u · adjusted`
              : (meal.insulinType ?? meal.doseType ?? undefined)
          }
        />
        <Stat
          label="Before meal"
          value={
            pre ? (
              <>
                {pre.value}
                <span className="text-xs font-normal text-muted-foreground ml-0.5">mg/dL</span>
              </>
            ) : (
              <span className="text-muted-foreground text-sm">—</span>
            )
          }
          sub={
            pre
              ? `${formatTime(pre.timestamp)} · ${describeOffset(pre.offsetMin)}`
              : `no reading in the ${BEFORE_WINDOW_MIN} min before`
          }
        />
        <Stat
          label="2 h after"
          value={
            after2h ? (
              <>
                {after2h.value}
                <span className="text-xs font-normal text-muted-foreground ml-0.5">mg/dL</span>
              </>
            ) : (
              <span className="text-muted-foreground text-sm">—</span>
            )
          }
          sub={
            after2h
              ? `${formatTime(after2h.timestamp)} · ${describeOffset(after2h.offsetMin)}`
              : "no reading near the 2 h mark"
          }
        />
      </div>

      {/* Context chips — macros, absorption, insulin brand, override, who logged (when present) */}
      {(() => {
        const chips: string[] = [];
        if (meal.insulinType) chips.push(meal.insulinType);
        if (meal.manualOverride && meal.recommendedUnits != null)
          chips.push(`Dose adjusted from recommended ${meal.recommendedUnits}u`);
        if (meal.fatGrams != null || meal.proteinGrams != null) {
          const macros = [
            meal.fatGrams != null ? `${meal.fatGrams}g fat` : null,
            meal.proteinGrams != null ? `${meal.proteinGrams}g protein` : null,
          ].filter(Boolean);
          if (macros.length) chips.push(macros.join(" · "));
        }
        if (meal.absorption) chips.push(`${meal.absorption} absorption`);
        if (!chips.length) return null;
        return (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {chips.map((c, i) => (
              <span
                key={i}
                className="text-[11px] px-2 py-0.5 rounded-full border border-border bg-secondary/40 text-muted-foreground"
              >
                {c}
              </span>
            ))}
          </div>
        );
      })()}

      <WhoLogged mealBy={meal.mealBy} doseBy={meal.doseBy} className="mt-3 text-xs" />

      {/* Response + correction */}
      <div className="grid grid-cols-1 2xl:grid-cols-[1fr_auto] gap-3 mt-3">
        <div className="rounded-xl border border-border bg-secondary/30 py-2">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground text-center mb-1">
            Glucose after meal
          </p>
          <div className="grid grid-cols-3">
            <AfterCell label="15m" reading={at15} delta={d(at15)} zones={review.zones} />
            <AfterCell label="30m" reading={at30} delta={d(at30)} zones={review.zones} />
            <AfterCell label="1h" reading={at60} delta={d(at60)} zones={review.zones} />
          </div>
        </div>
        <div className="rounded-xl border border-border bg-secondary/30 p-3 text-center lg:w-32">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Correction</p>
          <p className="text-lg font-display font-bold text-foreground mt-1">
            {correction != null ? `${correction}u` : "—"}
          </p>
        </div>
      </div>

      {/* Zoomed timeline around the meal */}
      <div className="mt-4">
        <DayTimelineChart
          readings={readings}
          markers={markers}
          zones={review.zones}
          domain={domain}
          height={260}
        />
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-2 gap-3 mt-3 border-t border-border/60 pt-3">
        <div className="text-center">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Glucose change</p>
          <p
            className={`text-lg font-display font-bold ${
              change == null
                ? "text-muted-foreground"
                : change > 0
                  ? "text-warning"
                  : change < 0
                    ? "text-success"
                    : "text-foreground"
            }`}
          >
            {change != null ? `${change > 0 ? "+" : ""}${change} mg/dL` : "—"}
          </p>
          <p className="text-[11px] text-muted-foreground">Before meal to peak (1h)</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Time in range (1h)
          </p>
          <p className="text-lg font-display font-bold text-foreground">
            {tir ? `${tir.pct}%` : "—"}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {tir ? `Above: ${tir.above}% · Below: ${tir.below}%` : "no readings in the hour after"}
          </p>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground border-t border-border/60 pt-3 mt-3 flex items-start gap-1.5">
        <ArrowRight className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span>
          Before meal is the last CGM reading before the meal was logged (within 30 min). 15m,
          30m and 1h are the readings closest to those marks (±12 min), each with the time it was
          taken and the change from before meal. 2 h after is the reading closest to two hours
          after the meal (±30 min) — the same value the meal card shows. Peak is the highest of
          15m/30m/1h; "—" means no CGM reading near that mark.
        </span>
      </p>
    </div>
  );
}
