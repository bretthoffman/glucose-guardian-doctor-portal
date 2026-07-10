import { ArrowDown, ArrowUp, Camera, Clock, Droplet, Minus, Syringe, Utensils } from "lucide-react";
import type { CGMReading, FoodLogEntry, PatientSnapshot } from "@doctor-portal/api-client-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { glucoseStatus, STATUS_META, zonesFromSnapshot } from "@/lib/glucose-metrics";
import { useGlucoseHistory } from "@/data/doctor-data";
import { formatDate, formatTime } from "@/lib/utils";

const MIN = 60_000;
const ms = (t: string) => new Date(t).getTime();

/** Nearest reading at/just before `t` (within `windowMin`) — the glucose "at the meal". */
function readingBefore(readings: CGMReading[], t: number, windowMin = 30): number | null {
  let best: CGMReading | null = null;
  for (const r of readings) {
    const rt = ms(r.timestamp);
    if (rt <= t && t - rt <= windowMin * MIN && (!best || rt > ms(best.timestamp))) best = r;
  }
  return best?.value ?? null;
}

/** Reading closest to `t + offsetMin` (within `windowMin` of that target), else null. */
function readingNear(
  readings: CGMReading[],
  t: number,
  offsetMin: number,
  windowMin = 12,
): number | null {
  const target = t + offsetMin * MIN;
  let best: CGMReading | null = null;
  let bestDist = Infinity;
  for (const r of readings) {
    const d = Math.abs(ms(r.timestamp) - target);
    if (d <= windowMin * MIN && d < bestDist) {
      best = r;
      bestDist = d;
    }
  }
  return best?.value ?? null;
}

const CONFIDENCE_CHIP: Record<string, string> = {
  high: "bg-success/15 text-success border-success/30",
  medium: "bg-warning/15 text-warning border-warning/30",
  low: "bg-destructive/15 text-destructive border-destructive/30",
};

function TrendCell({
  label,
  value,
  baseline,
  snapshot,
}: {
  label: string;
  value: number | null;
  baseline: number | null;
  snapshot: PatientSnapshot;
}) {
  const zones = zonesFromSnapshot(snapshot);
  const meta = value != null ? STATUS_META[glucoseStatus(value, zones)] : null;
  const delta = value != null && baseline != null ? value - baseline : null;
  const Arrow = delta == null || delta === 0 ? Minus : delta > 0 ? ArrowUp : ArrowDown;
  return (
    <div className="rounded-xl border border-border bg-secondary/30 p-2.5 text-center">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`text-lg font-display font-bold leading-tight ${meta?.text ?? "text-muted-foreground"}`}>
        {value != null ? value : "—"}
      </p>
      {delta != null ? (
        <p
          className={`text-[11px] flex items-center justify-center gap-0.5 ${
            delta > 0 ? "text-warning" : delta < 0 ? "text-success" : "text-muted-foreground"
          }`}
        >
          <Arrow className="w-3 h-3" />
          {delta === 0 ? "0" : `${delta > 0 ? "+" : "−"}${Math.abs(delta)}`}
        </p>
      ) : (
        <p className="text-[11px] text-muted-foreground">{label === "At meal" ? "mg/dL" : "—"}</p>
      )}
    </div>
  );
}

/**
 * Full detail for one logged meal: the complete (untruncated) description, the meal photo when the
 * app has synced it, carbs/insulin/confidence, and the post-meal glucose response at 15/30/60 min —
 * so the doctor sees the whole story and how the patient responded, without leaving the day review.
 */
export function MealDetailDialog({
  food,
  snapshot,
  open,
  onOpenChange,
}: {
  food: FoodLogEntry | null;
  snapshot: PatientSnapshot;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  // Fetch the CGM window around this meal from the full-history store so the response is available
  // for ANY meal, not just those inside the ~1-day sync snapshot. Hook runs unconditionally (before
  // the null-guard) and disables itself when there's no meal open. Falls back to snapshot readings.
  const mealMs = food ? ms(food.timestamp) : 0;
  const hist = useGlucoseHistory(snapshot.accessCode, mealMs - 45 * MIN, mealMs + 90 * MIN);

  if (!food) return null;
  const t = mealMs;
  const readings = hist.readings?.length ? hist.readings : (snapshot.glucoseReadings ?? []);
  const atMeal = readingBefore(readings, t);
  const at15 = readingNear(readings, t, 15);
  const at30 = readingNear(readings, t, 30);
  const at60 = readingNear(readings, t, 60);
  const peak = [at15, at30, at60].filter((v): v is number => v != null);
  const maxAfter = peak.length ? Math.max(...peak) : null;
  const excursion = atMeal != null && maxAfter != null ? maxAfter - atMeal : null;
  const photo = food.photoDataUri?.startsWith("data:image/") ? food.photoDataUri : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="flex items-start gap-2 pr-6">
            <Utensils className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <span className="min-w-0 break-words">{food.foodName}</span>
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {formatDate(food.timestamp)} · {formatTime(food.timestamp)}
            </span>
            {food.confidence && (
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full border ${CONFIDENCE_CHIP[food.confidence] ?? "border-border text-muted-foreground"}`}
              >
                {food.confidence} confidence
              </span>
            )}
            {food.fromPhoto && (
              <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border border-border text-muted-foreground">
                <Camera className="w-3 h-3" /> photo-logged
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {photo ? (
          <img
            src={photo}
            alt={food.foodName}
            className="w-full max-h-64 object-cover rounded-xl border border-border"
          />
        ) : food.fromPhoto ? (
          <div className="rounded-xl border border-dashed border-border bg-secondary/30 p-4 flex items-center gap-3">
            <Camera className="w-5 h-5 text-muted-foreground shrink-0" />
            <p className="text-xs text-muted-foreground">
              The caregiver photographed this meal in the app. Meal photos appear here once the
              app update that syncs them ships.
            </p>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-border bg-secondary/30 p-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
              <Droplet className="w-3 h-3" /> Estimated carbs
            </p>
            <p className="text-lg font-display font-bold text-foreground">
              {food.estimatedCarbs}
              <span className="text-xs font-normal text-muted-foreground ml-1">g</span>
            </p>
          </div>
          <div className="rounded-xl border border-border bg-secondary/30 p-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
              <Syringe className="w-3 h-3" /> Insulin given
            </p>
            <p className="text-lg font-display font-bold text-foreground">
              {food.insulinUnits ? (
                <>
                  {food.insulinUnits}
                  <span className="text-xs font-normal text-muted-foreground ml-1">u</span>
                </>
              ) : (
                <span className="text-muted-foreground">none</span>
              )}
            </p>
          </div>
        </div>

        {/* Post-meal glucose response */}
        <div>
          <p className="text-xs font-medium text-foreground mb-2">Glucose response</p>
          <div className="grid grid-cols-4 gap-2">
            <TrendCell label="At meal" value={atMeal} baseline={null} snapshot={snapshot} />
            <TrendCell label="+15 min" value={at15} baseline={atMeal} snapshot={snapshot} />
            <TrendCell label="+30 min" value={at30} baseline={atMeal} snapshot={snapshot} />
            <TrendCell label="+1 hr" value={at60} baseline={atMeal} snapshot={snapshot} />
          </div>
          {excursion != null && (
            <p className="text-xs text-muted-foreground mt-2">
              Glucose {excursion > 0 ? "rose" : excursion < 0 ? "fell" : "held steady"}
              {excursion !== 0 && ` ${Math.abs(excursion)} mg/dL`} at its peak within the hour after
              this meal.
            </p>
          )}
        </div>

        <p className="text-[11px] text-muted-foreground border-t border-border/60 pt-3">
          "At meal" is the CGM reading nearest the log time (within 30 min). Each interval is the
          reading closest to 15, 30, and 60 minutes after — within ±12 min of that mark — and the
          arrow is the change from the at-meal value. Intervals with no CGM reading nearby are shown
          as "—" (e.g. a sensor gap or a meal logged after the last reading).
        </p>
      </DialogContent>
    </Dialog>
  );
}
