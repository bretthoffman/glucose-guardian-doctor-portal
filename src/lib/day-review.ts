import type {
  CGMReading,
  FoodLogEntry,
  InsulinLogEntry,
  PatientSnapshot,
} from "@doctor-portal/api-client-react";
import { glucoseStatus, zonesFromSnapshot, type GlucoseZones } from "./glucose-metrics";

// ─── Types ───────────────────────────────────────────────────────────────────

export type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";
export type DoseType = InsulinLogEntry["type"]; // "bolus" | "correction" | "manual"
export type Direction = "up" | "down" | "stable";

export interface DayMeal {
  id: string;
  slot: MealSlot;
  timestamp: string;
  name: string;
  carbs: number;
  fromPhoto: boolean;
  units: number | null;
  doseType: DoseType | null;
  preGlucose: number | null;
  postGlucose: number | null;
  direction: Direction | null;
}

export interface DayEvent {
  id: string;
  timestamp: string;
  kind: "meal" | "correction" | "insulin";
  label: string;
  slot?: MealSlot;
  carbs: number | null;
  preGlucose: number | null;
  postGlucose: number | null;
  units: number | null;
  doseType: DoseType | null;
  note: string;
  fromPhoto: boolean;
}

export interface DayMarker {
  ts: number;
  kind: "meal" | "correction" | "insulin";
  carbs: number | null;
  units: number | null;
}

export interface DaySummary {
  totalCarbs: number;
  totalInsulin: number;
  basal: number;
  bolus: number;
  correction: number;
  bolusCount: number;
  correctionCount: number;
  tir: number | null;
  avg: number | null;
  gmi: string | null;
  lastMeal: DayMeal | null;
  completeness: number;
  readingCount: number;
}

export interface DayFlag {
  id: string;
  title: string;
  detail: string;
  severity: "high" | "warning" | "info";
}

export interface DayPattern {
  id: string;
  title: string;
  detail: string;
  tone: "good" | "warn" | "info";
}

export interface DayRatios {
  carbRatio?: number;
  correctionFactor?: number;
  targetGlucose?: number;
  targetLow?: number;
  targetHigh?: number;
}

export interface DayReview {
  key: string;
  date: Date;
  zones: GlucoseZones;
  readings: CGMReading[];
  meals: DayMeal[];
  events: DayEvent[];
  markers: DayMarker[];
  summary: DaySummary;
  flags: DayFlag[];
  patterns: DayPattern[];
  ratios: DayRatios;
  dayStartMs: number;
  dayEndMs: number;
}

export interface DayChip {
  key: string;
  date: Date;
  weekday: string;
  label: string;
  meals: number;
  insulin: number;
  hasHigh: boolean;
  hasData: boolean;
  hasNotes: boolean;
  isToday: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ms = (t: string) => new Date(t).getTime();
const MIN = 60 * 1000;

export function localDayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function dayKeyOf(timestamp: string): string {
  return localDayKey(new Date(timestamp));
}

function startOfDay(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

export function slotForHour(h: number): MealSlot {
  if (h < 11) return "breakfast";
  if (h < 16) return "lunch";
  if (h < 21) return "dinner";
  return "snack";
}

export const SLOT_LABEL: Record<MealSlot, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

function gmiFromAvg(avg: number): string {
  return (3.31 + 0.02392 * avg).toFixed(1);
}

/** Nearest reading at/just before `t` (within `windowMin`). */
function readingBefore(readings: CGMReading[], t: number, windowMin = 60): number | null {
  let best: CGMReading | null = null;
  for (const r of readings) {
    const rt = ms(r.timestamp);
    if (rt <= t && t - rt <= windowMin * MIN) {
      if (!best || rt > ms(best.timestamp)) best = r;
    }
  }
  return best?.value ?? null;
}

/** Reading closest to `t + offsetMin` (within `windowMin` of that target). */
function readingAfter(
  readings: CGMReading[],
  t: number,
  offsetMin = 120,
  windowMin = 75,
): number | null {
  const target = t + offsetMin * MIN;
  let best: CGMReading | null = null;
  let bestGap = Infinity;
  for (const r of readings) {
    const rt = ms(r.timestamp);
    if (rt <= t) continue;
    const gap = Math.abs(rt - target);
    if (gap <= windowMin * MIN && gap < bestGap) {
      best = r;
      bestGap = gap;
    }
  }
  return best?.value ?? null;
}

function directionOf(pre: number | null, post: number | null): Direction | null {
  if (pre == null || post == null) return null;
  const d = post - pre;
  if (d > 15) return "up";
  if (d < -15) return "down";
  return "stable";
}

// ─── Calendar strip ──────────────────────────────────────────────────────────

/** The latest local day for which the snapshot holds any data (readings/meals/insulin). */
function latestDataDay(s: PatientSnapshot): Date {
  const stamps: number[] = [];
  const push = (arr?: { timestamp: string }[]) => arr?.forEach((x) => stamps.push(ms(x.timestamp)));
  push(s.glucoseReadings);
  push(s.insulinLog);
  push(s.foodLog);
  if (!stamps.length) return new Date();
  return new Date(Math.max(...stamps));
}

export function defaultDayKey(s: PatientSnapshot): string {
  // Prefer the most recent day that has meals or insulin (the richest review), else latest data.
  const eventStamps = [...(s.foodLog ?? []), ...(s.insulinLog ?? [])].map((x) => ms(x.timestamp));
  if (eventStamps.length) return dayKeyOf(new Date(Math.max(...eventStamps)).toISOString());
  return localDayKey(latestDataDay(s));
}

export function listDays(s: PatientSnapshot, count = 7): DayChip[] {
  const end = latestDataDay(s);
  const todayKey = localDayKey(new Date());
  const zones = zonesFromSnapshot(s);
  const chips: DayChip[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const date = new Date(end.getFullYear(), end.getMonth(), end.getDate() - i);
    const key = localDayKey(date);
    const meals = (s.foodLog ?? []).filter((f) => dayKeyOf(f.timestamp) === key).length;
    const insulin = (s.insulinLog ?? []).filter((l) => dayKeyOf(l.timestamp) === key).length;
    const dayReadings = (s.glucoseReadings ?? []).filter((r) => dayKeyOf(r.timestamp) === key);
    const hasHigh = dayReadings.some((r) => r.value >= zones.urgentHigh);
    chips.push({
      key,
      date,
      weekday: date.toLocaleDateString(undefined, { weekday: "short" }),
      label: date.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      meals,
      insulin,
      hasHigh,
      hasData: meals > 0 || insulin > 0 || dayReadings.length > 0,
      hasNotes: false,
      isToday: key === todayKey,
    });
  }
  return chips;
}

// ─── Day review ──────────────────────────────────────────────────────────────

export function buildDayReview(s: PatientSnapshot, key: string): DayReview {
  const zones = zonesFromSnapshot(s);
  const dayStart = startOfDay(key);
  const dayStartMs = dayStart.getTime();
  const dayEndMs = dayStartMs + 24 * 60 * MIN;

  const readings = [...(s.glucoseReadings ?? [])]
    .filter((r) => dayKeyOf(r.timestamp) === key)
    .sort((a, b) => ms(a.timestamp) - ms(b.timestamp));
  const foods = [...(s.foodLog ?? [])]
    .filter((f) => dayKeyOf(f.timestamp) === key)
    .sort((a, b) => ms(a.timestamp) - ms(b.timestamp));
  const insulin = [...(s.insulinLog ?? [])]
    .filter((l) => dayKeyOf(l.timestamp) === key)
    .sort((a, b) => ms(a.timestamp) - ms(b.timestamp));

  const usedInsulinIds = new Set<string>();
  const insulinForFood = (food: FoodLogEntry): InsulinLogEntry | null => {
    const linked = insulin.find((l) => l.foodLogId === food.id && !usedInsulinIds.has(l.id));
    if (linked) return linked;
    // Fall back to a bolus within 25 min of the meal.
    let best: InsulinLogEntry | null = null;
    let bestGap = Infinity;
    for (const l of insulin) {
      if (usedInsulinIds.has(l.id) || l.type === "correction") continue;
      const gap = Math.abs(ms(l.timestamp) - ms(food.timestamp));
      if (gap <= 25 * MIN && gap < bestGap) {
        best = l;
        bestGap = gap;
      }
    }
    return best;
  };

  const meals: DayMeal[] = foods.map((food) => {
    const dose = insulinForFood(food);
    if (dose) usedInsulinIds.add(dose.id);
    const t = ms(food.timestamp);
    const pre = readingBefore(readings, t);
    const post = readingAfter(readings, t);
    return {
      id: food.id,
      slot: slotForHour(new Date(food.timestamp).getHours()),
      timestamp: food.timestamp,
      name: food.foodName,
      carbs: food.estimatedCarbs,
      fromPhoto: food.fromPhoto,
      units: dose?.units ?? null,
      doseType: dose?.type ?? null,
      preGlucose: pre,
      postGlucose: post,
      direction: directionOf(pre, post),
    };
  });

  // Events = meals + any insulin not already attached to a meal.
  const events: DayEvent[] = meals.map((m) => ({
    id: `meal-${m.id}`,
    timestamp: m.timestamp,
    kind: "meal",
    label: SLOT_LABEL[m.slot],
    slot: m.slot,
    carbs: m.carbs,
    preGlucose: m.preGlucose,
    postGlucose: m.postGlucose,
    units: m.units,
    doseType: m.doseType,
    note: m.name,
    fromPhoto: m.fromPhoto,
  }));
  for (const l of insulin) {
    if (usedInsulinIds.has(l.id)) continue;
    const t = ms(l.timestamp);
    const isCorr = l.type === "correction";
    events.push({
      id: `ins-${l.id}`,
      timestamp: l.timestamp,
      kind: isCorr ? "correction" : "insulin",
      label: isCorr ? "Correction" : l.type === "manual" ? "Basal / Manual" : "Insulin",
      carbs: null,
      preGlucose: readingBefore(readings, t),
      postGlucose: isCorr ? readingAfter(readings, t) : null,
      units: l.units,
      doseType: l.type,
      note: l.note ?? "",
      fromPhoto: false,
    });
  }
  events.sort((a, b) => ms(a.timestamp) - ms(b.timestamp));

  const markers: DayMarker[] = events
    .filter((e) => e.kind !== "insulin" || e.units != null)
    .map((e) => ({
      ts: ms(e.timestamp),
      kind: e.kind,
      carbs: e.carbs,
      units: e.units,
    }));

  // Summary
  const values = readings.map((r) => r.value);
  const n = values.length;
  const avg = n ? Math.round(values.reduce((a, b) => a + b, 0) / n) : null;
  const tir = n
    ? Math.round((values.filter((v) => v >= zones.low && v <= zones.high).length / n) * 100)
    : null;
  const sum = (arr: InsulinLogEntry[]) => arr.reduce((a, l) => a + l.units, 0);
  const summary: DaySummary = {
    totalCarbs: foods.reduce((a, f) => a + f.estimatedCarbs, 0),
    totalInsulin: sum(insulin),
    basal: sum(insulin.filter((l) => l.type === "manual")),
    bolus: sum(insulin.filter((l) => l.type === "bolus")),
    correction: sum(insulin.filter((l) => l.type === "correction")),
    bolusCount: insulin.filter((l) => l.type === "bolus").length,
    correctionCount: insulin.filter((l) => l.type === "correction").length,
    tir,
    avg,
    gmi: avg != null ? gmiFromAvg(avg) : null,
    lastMeal: meals.length ? meals[meals.length - 1] : null,
    completeness: completenessFor(key, readings.length, dayStartMs, dayEndMs),
    readingCount: n,
  };

  const ratios: DayRatios = {
    carbRatio: s.profile.carbRatio,
    correctionFactor: s.profile.correctionFactor,
    targetGlucose: s.profile.targetGlucose,
    targetLow: s.alertPreferences?.lowThreshold ?? zones.low,
    targetHigh: s.alertPreferences?.highThreshold ?? zones.high,
  };

  return {
    key,
    date: dayStart,
    zones,
    readings,
    meals,
    events,
    markers,
    summary,
    flags: buildFlags(meals, insulin, zones),
    patterns: buildPatterns(readings, zones),
    ratios,
    dayStartMs,
    dayEndMs,
  };
}

function completenessFor(key: string, readingCount: number, startMs: number, endMs: number): number {
  const now = Date.now();
  const cap = Math.min(now, endMs);
  const elapsedMin = Math.max(5 * 60, (cap - startMs) / MIN); // at least a few hours of expectation
  const expected = Math.max(1, Math.round(elapsedMin / 5));
  return Math.min(100, Math.round((readingCount / expected) * 100));
}

// ─── Clinical flags ──────────────────────────────────────────────────────────

function buildFlags(meals: DayMeal[], insulin: InsulinLogEntry[], zones: GlucoseZones): DayFlag[] {
  const flags: DayFlag[] = [];

  for (const m of meals) {
    if (m.postGlucose != null && m.postGlucose > zones.high) {
      const sev = m.postGlucose >= zones.urgentHigh ? "high" : "warning";
      flags.push({
        id: `hyper-${m.id}`,
        title: `Post-${SLOT_LABEL[m.slot]} Hyperglycemia`,
        detail: `Post-meal glucose reached ${m.postGlucose} mg/dL. Consider adjusting ${m.slot} carb ratio or timing.`,
        severity: sev,
      });
    }
    if (m.units == null && m.carbs >= 15) {
      flags.push({
        id: `noins-${m.id}`,
        title: `Missing insulin for ${SLOT_LABEL[m.slot]}`,
        detail: `${m.carbs}g logged with no bolus recorded. Confirm the dose was given.`,
        severity: "warning",
      });
    }
    if (
      m.units != null &&
      m.postGlucose != null &&
      m.preGlucose != null &&
      m.postGlucose - m.preGlucose > 60 &&
      m.postGlucose > zones.high
    ) {
      flags.push({
        id: `under-${m.id}`,
        title: `Possible under-bolus at ${SLOT_LABEL[m.slot]}`,
        detail: `Glucose rose ${m.postGlucose - m.preGlucose} mg/dL after ${m.units}u for ${m.carbs}g.`,
        severity: "warning",
      });
    }
  }

  // Late correction: a correction dose more than 60 min after a high meal post-reading.
  const corrections = insulin.filter((l) => l.type === "correction");
  if (corrections.length) {
    flags.push({
      id: "corr",
      title: corrections.length > 1 ? "Multiple correction doses" : "Correction dose given",
      detail: `${corrections.length} correction${corrections.length > 1 ? "s" : ""} totaling ${corrections
        .reduce((a, l) => a + l.units, 0)
        .toFixed(1)}u. Review for stacking.`,
      severity: "info",
    });
  }

  return flags;
}

// ─── Daily patterns ──────────────────────────────────────────────────────────

function buildPatterns(readings: CGMReading[], zones: GlucoseZones): DayPattern[] {
  const out: DayPattern[] = [];
  if (!readings.length) return out;

  const inWindow = (from: number, to: number) =>
    readings.filter((r) => {
      const h = new Date(r.timestamp).getHours();
      return h >= from && h < to;
    });

  const evening = inWindow(18, 23);
  if (evening.length >= 3) {
    const highs = evening.filter((r) => r.value > zones.high).length / evening.length;
    if (highs > 0.4) {
      out.push({
        id: "evening",
        title: "Evening highs",
        detail: `Glucose >${zones.high} mg/dL after dinner`,
        tone: "warn",
      });
    }
  }

  const afternoon = inWindow(13, 16);
  if (afternoon.length >= 3 && Math.max(...afternoon.map((r) => r.value)) > zones.high) {
    out.push({
      id: "afternoon",
      title: "Afternoon spike",
      detail: "Recurring spike around 2–3 PM",
      tone: "warn",
    });
  }

  const overnight = inWindow(0, 6);
  if (overnight.length >= 3) {
    const inRange =
      overnight.filter((r) => r.value >= zones.low && r.value <= zones.high).length /
      overnight.length;
    const lows = overnight.some((r) => r.value < zones.low);
    if (lows) {
      out.push({
        id: "overnight-low",
        title: "Overnight lows",
        detail: "One or more readings below range (12–6 AM)",
        tone: "warn",
      });
    } else if (inRange >= 0.7) {
      out.push({
        id: "overnight-good",
        title: "Good overnight control",
        detail: `Overnight in range ${Math.round(inRange * 100)}% of the time`,
        tone: "good",
      });
    }
  }

  return out;
}
