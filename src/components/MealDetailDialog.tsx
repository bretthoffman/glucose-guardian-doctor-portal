import { ArrowRight, Camera, Clock, Droplet, Syringe, Utensils } from "lucide-react";
import type { CGMReading, FoodLogEntry, PatientSnapshot } from "@doctor-portal/api-client-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { glucoseStatus, STATUS_META, zonesFromSnapshot } from "@/lib/glucose-metrics";
import { formatDate, formatTime } from "@/lib/utils";

const MIN = 60_000;
const ms = (t: string) => new Date(t).getTime();

/** Nearest reading at/just before `t` (within 60 min). */
function readingBefore(readings: CGMReading[], t: number): number | null {
  let best: CGMReading | null = null;
  for (const r of readings) {
    const rt = ms(r.timestamp);
    if (rt <= t && t - rt <= 60 * MIN && (!best || rt > ms(best.timestamp))) best = r;
  }
  return best?.value ?? null;
}

/** Reading closest to `t + 120 min` (within 75 min of that target). */
function readingAfter(readings: CGMReading[], t: number): number | null {
  const target = t + 120 * MIN;
  let best: CGMReading | null = null;
  let bestDist = Infinity;
  for (const r of readings) {
    const d = Math.abs(ms(r.timestamp) - target);
    if (d <= 75 * MIN && d < bestDist) {
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

function GlucoseStat({
  label,
  value,
  snapshot,
}: {
  label: string;
  value: number | null;
  snapshot: PatientSnapshot;
}) {
  const zones = zonesFromSnapshot(snapshot);
  const meta = value != null ? STATUS_META[glucoseStatus(value, zones)] : null;
  return (
    <div className="rounded-xl border border-border bg-secondary/30 p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`text-lg font-display font-bold ${meta?.text ?? "text-muted-foreground"}`}>
        {value != null ? value : "—"}
        {value != null && (
          <span className="text-xs font-normal text-muted-foreground ml-1">mg/dL</span>
        )}
      </p>
    </div>
  );
}

/**
 * Full detail for one logged meal: the complete (untruncated) description, the meal photo when
 * the app has synced it, carbs/insulin/confidence, and the glucose response around the meal —
 * so the doctor reads the whole story without squinting at a truncated row.
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
  if (!food) return null;
  const t = ms(food.timestamp);
  const readings = snapshot.glucoseReadings ?? [];
  const before = readingBefore(readings, t);
  const after = readingAfter(readings, t);
  const delta = before != null && after != null ? after - before : null;
  const photo = food.photoDataUri?.startsWith("data:image/") ? food.photoDataUri : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
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
          <GlucoseStat label="Glucose before" value={before} snapshot={snapshot} />
          <GlucoseStat label="~2h after" value={after} snapshot={snapshot} />
        </div>

        {delta != null && (
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <ArrowRight className="w-3.5 h-3.5" />
            Glucose {delta > 0 ? "rose" : delta < 0 ? "fell" : "held steady"}
            {delta !== 0 && ` ${Math.abs(delta)} mg/dL`} in the ~2 hours after this meal.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
