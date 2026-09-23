import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, Info, NotebookPen } from "lucide-react";
import { useSendDoctorMessage, type PatientSnapshot } from "@doctor-portal/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useProposeOrder } from "@/data/doctor-data";
import type { PatientDetail, TherapyOrderValues } from "@/data/contracts";
import { calculateDose, typicalCarbs, type DoseCalculation } from "@/lib/dose-calc";
import { RAPID_DIA_MIN, REGULAR_DIA_MIN, formatAgeShort } from "@/lib/app-dose/onBoard";
import { INSULIN_TYPE_LABEL } from "@/lib/app-dose/insulin";
import { formatTime } from "@/lib/utils";

type LineKey = "correction" | "carb" | "activeCarbs" | "activeInsulin" | "dose";

const r2 = (n: number) => Math.round(n * 100) / 100;
const u = (n: number) => `${r2(n)}u`;
const ago = (min: number | null) => (min != null && min >= 1 ? `${formatAgeShort(min)} ago` : "just now");

/** Doctor-facing wording of the app's own per-card explanations (utils/doseExplain in the app). */
function explain(key: LineKey, c: DoseCalculation): string[] {
  const d = c.breakdown;
  const cf = c.settings.correctionFactor;
  const cr = c.settings.carbRatio;
  const held = d.correctionHeldUnits > 0.001;
  switch (key) {
    case "correction": {
      const lines = d.correctionSuppressed
        ? [`The reading (${c.bg.value} mg/dL) is at or below the ${c.target} mg/dL target, so no correction is added.`]
        : [`(${c.bg.value} − ${c.target}) ÷ correction factor ${cf} = ${u(d.correctionInsulin)}.`];
      if (d.resistanceBump > 0.001)
        lines.push(`Above 300 mg/dL the app adds 10% (${u(d.resistanceBump)}) because corrections under-deliver that high.`);
      if (Math.abs(d.trendAdjustment) >= 0.005)
        lines.push(
          `Trend ${d.trendLabel} ${d.trendAdjustment > 0 ? "adds" : "trims"} ${u(Math.abs(d.trendAdjustment))}: the change expected over the next 30 min ÷ ${cf} (capped at ±2u).`,
        );
      else if (d.hyperTrendZeroed)
        lines.push(`Glucose is falling but still high, so the usual falling-trend reduction is skipped.`);
      if (held)
        lines.push(
          `A dose ${ago(c.activeInsulin.lastDoseAgeMin)} is still in its onset lag, so this correction (${u(d.correctionHeldUnits)}) is on hold for ~${d.correctionHoldRemainingMin} more min to avoid stacking.`,
        );
      return lines;
    }
    case "carb":
      return c.carbs > 0
        ? [`${c.carbs} g ÷ carb ratio ${cr} = ${u(d.carbInsulin)}.`, `Carb insulin is never reduced by insulin on board — food is always covered in full.`]
        : [`No carbs entered, so no carb dose. Enter grams above to see a meal dose.`];
    case "activeCarbs": {
      if (!(c.activeCarbs.totalGrams > 0)) return [`Nothing from recent meals is still absorbing.`];
      const lines = [
        `About ${c.activeCarbs.totalGrams} g from food logged ${ago(c.activeCarbs.lastEntryAgeMin)} are still absorbing — ${u(d.activeCarbInsulin)} at the carb ratio (fast 2 h, medium 3 h, slow 4 h absorption).`,
      ];
      lines.push(
        d.uncoveredCarbInsulin > 0.001
          ? `Insulin on board covers part of it; the uncovered ${u(d.uncoveredCarbInsulin)} is added.`
          : `Insulin already on board covers them, so nothing is added here.`,
      );
      return lines;
    }
    case "activeInsulin": {
      if (!(d.activeInsulinUnits > 0)) return [`No mealtime insulin is still active, so nothing is subtracted.`];
      const src =
        c.activeInsulin.doseCount > 1 ? `${c.activeInsulin.doseCount} recent doses` : `a dose ${ago(c.activeInsulin.lastDoseAgeMin)}`;
      const lines = [
        `${u(d.activeInsulinUnits)} still active from ${src} (curvilinear decay; basal insulin never counts).`,
      ];
      if (d.activeCarbInsulin > 0.001)
        lines.push(`It's netted against the ${u(d.activeCarbInsulin)} of absorbing carbs first — only the surplus is credited.`);
      if (d.iobDiscounted)
        lines.push(`Glucose is high and not falling despite it, so only half of the older insulin is credited.`);
      if (held) lines.push(`No credit is taken while the correction is on hold.`);
      else if (d.iobCredit > 0.001)
        lines.push(`${u(d.iobCredit)} is subtracted from the correction only — never from the carb dose.`);
      else lines.push(`There's no correction for it to reduce, so it doesn't change the dose.`);
      return lines;
    }
    case "dose": {
      const lines = [`Subtotal ${u(d.subTotal)}.`];
      if (Math.abs(d.patternDelta) >= 0.005)
        lines.push(
          `Pattern adjustment ×${d.patternFactor} (${d.patternDelta > 0 ? "+" : "−"}${u(Math.abs(d.patternDelta))}): ${c.settings.bucketLabel.toLowerCase()} doses given over the last 2 weeks ran ${d.patternFactor > 1 ? "above" : "below"} the app's suggestions (${c.tuning.sampleCount} doses). The saved settings are unchanged.`,
        );
      if (d.cappedAtMax)
        lines.push(`Capped at the ${u(d.maxDoseCap)} single-dose safety limit${c.breakdown.maxDoseCap === 10 ? "" : " (0.2 u/kg of body weight)"}.`);
      lines.push(`${u(d.totalRaw)} rounds to ${u(d.totalDose)} (nearest half unit).`);
      return lines;
    }
  }
}

function Line({
  op,
  label,
  value,
  sub,
  open,
  onToggle,
  details,
  strong = false,
}: {
  op: string;
  label: string;
  value: string;
  sub: string;
  open: boolean;
  onToggle: () => void;
  details: string[];
  strong?: boolean;
}) {
  return (
    <div className={strong ? "border-t border-border pt-2 mt-1" : ""}>
      <button onClick={onToggle} className="w-full flex items-start gap-2 text-left rounded-lg px-1.5 py-1.5 -mx-1.5 hover:bg-secondary/50">
        <span className="w-4 text-center text-muted-foreground font-medium shrink-0">{op}</span>
        <span className="min-w-0 flex-1">
          <span className={`block text-sm ${strong ? "font-semibold text-foreground" : "text-foreground"}`}>{label}</span>
          <span className="block text-[11px] text-muted-foreground">{sub}</span>
        </span>
        <span className={`font-display shrink-0 ${strong ? "text-lg font-bold text-primary" : "text-sm font-semibold text-foreground"}`}>
          {value}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground shrink-0 mt-1 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <ul className="ml-6 mb-1.5 space-y-1">
          {details.map((d) => (
            <li key={d} className="text-[11px] text-muted-foreground leading-snug">
              {d}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Propose new all-day settings (caregiver approves in the app) — or, with no change, send a note. */
function SuggestChange({ detail, calc, onDone }: { detail: PatientDetail; calc: DoseCalculation; onDone: (msg: string) => void }) {
  const active = detail.activeOrder;
  const [carbRatio, setCarbRatio] = useState(String(active?.carbRatio ?? ""));
  const [correctionFactor, setCorrectionFactor] = useState(String(active?.correctionFactor ?? ""));
  const [targetGlucose, setTargetGlucose] = useState(String(active?.targetGlucose ?? ""));
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const propose = useProposeOrder();
  const sendMessage = useSendDoctorMessage();
  const num = (s: string) => (s.trim() === "" || Number.isNaN(Number(s)) ? undefined : Number(s));
  const changed =
    num(carbRatio) !== active?.carbRatio ||
    num(correctionFactor) !== active?.correctionFactor ||
    num(targetGlucose) !== active?.targetGlucose;
  const pendingProposal = !!detail.proposedOrder;
  const busy = propose.isPending || sendMessage.isPending;
  const canSend = note.trim().length > 0 && !busy && !(changed && (pendingProposal || !detail.canPrescribe));

  const submit = async () => {
    setError(null);
    if (changed) {
      const values: TherapyOrderValues = {
        carbRatio: num(carbRatio),
        correctionFactor: num(correctionFactor),
        targetGlucose: num(targetGlucose),
        insulinTypes: active?.insulinTypes,
        alertThresholds: active?.alertThresholds,
      };
      try {
        await propose.mutate({ patientId: detail.patientId, baseVersion: active?.version ?? 0, values, note: note.trim() });
        onDone("Change proposed — the caregiver confirms it in the app.");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not send the proposal.");
      }
      return;
    }
    const s = calc.settings;
    const context = `About the dose calculator (${s.bucketLabel.toLowerCase()} settings: carb ratio 1:${s.carbRatio}, correction factor 1:${s.correctionFactor}, target ${calc.target} mg/dL):`;
    sendMessage.mutate(
      { accessCode: detail.accessCode, data: { text: `${context}\n${note.trim()}`, sender: "doctor" } },
      {
        onSuccess: () => onDone("Note sent to the parents."),
        onError: () => setError("Could not send the note. Try again."),
      },
    );
  };

  const field = (label: string, value: string, set: (v: string) => void, unit: string) => (
    <label className="block min-w-0">
      <span className="block text-[10px] uppercase tracking-wide text-muted-foreground mb-1">{label}</span>
      <span className="flex items-center gap-1">
        <Input value={value} onChange={(e) => set(e.target.value)} inputMode="decimal" className="h-8 text-sm px-2" />
        <span className="text-[10px] text-muted-foreground shrink-0">{unit}</span>
      </span>
    </label>
  );

  return (
    <div className="mt-3 rounded-xl border border-border bg-secondary/30 p-3 space-y-2.5">
      <p className="text-sm font-medium text-foreground">Suggest a change</p>
      <div className="grid grid-cols-3 gap-2">
        {field("Carb ratio", carbRatio, setCarbRatio, "g/u")}
        {field("Correction", correctionFactor, setCorrectionFactor, "mg/dL")}
        {field("Target", targetGlucose, setTargetGlucose, "mg/dL")}
      </div>
      {calc.settings.usedOverride && (
        <p className="text-[11px] text-muted-foreground">
          {calc.settings.bucketLabel} uses its own setting in the app. These fields change the all-day values — describe
          meal-time changes in the note.
        </p>
      )}
      <Textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
        placeholder="What should change, and why?"
        className="text-sm"
        aria-label="Note (required)"
      />
      {changed && pendingProposal && (
        <p className="text-[11px] text-amber-600">A change is already awaiting the caregiver's approval — send a note instead.</p>
      )}
      {error && <p className="text-[11px] text-destructive">{error}</p>}
      <div>
        <Button size="sm" disabled={!canSend} onClick={submit}>
          {changed ? "Send proposal to caregiver" : "Send note to parents"}
        </Button>
        <p className="text-[11px] text-muted-foreground mt-1.5">
          {changed
            ? "They approve or decline it in the app, with your note."
            : "Arrives in their Doctor thread. Change a value above to send it as a proposal instead."}
        </p>
      </div>
    </div>
  );
}

/**
 * "Dose Calculation" for the Overview: the app's own calculator run live on this patient's data —
 * Correct BG + Carb Dose + Active Carbs − Active Insulin = Dose — with each step's math on click,
 * the settings it used, and a way to suggest a change.
 */
export function DoseCalculationCard({ snapshot, detail }: { snapshot: PatientSnapshot; detail?: PatientDetail }) {
  const [carbsText, setCarbsText] = useState(() => {
    const typical = typicalCarbs(snapshot);
    return typical > 0 ? String(typical) : "";
  });
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  const carbs = Math.max(0, Math.min(500, Number(carbsText) || 0));
  const calc = useMemo(() => calculateDose(snapshot, carbs, now), [snapshot, carbs, now]);
  const [open, setOpen] = useState<LineKey | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const toggle = (k: LineKey) => setOpen((o) => (o === k ? null : k));

  if (!calc) {
    return <p className="text-sm text-muted-foreground">No recent CGM reading, so the app's calculator has nothing to start from.</p>;
  }
  const d = calc.breakdown;
  const held = d.correctionHeldUnits > 0.001;
  const correctionShown = held ? 0 : Math.max(0, d.correctionInsulin + d.resistanceBump + d.trendAdjustment);
  const warning = d.warnings[0];
  const s = calc.settings;
  const dia = calc.insulin?.type === "regular" || calc.insulin?.type === "premixed" ? REGULAR_DIA_MIN : RAPID_DIA_MIN;

  return (
    <div>
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">If they eat</span>
        <Input
          value={carbsText}
          onChange={(e) => setCarbsText(e.target.value.replace(/[^\d.]/g, ""))}
          inputMode="decimal"
          className="h-8 w-16 text-sm px-2"
          aria-label="Carbs in grams"
        />
        <span className="text-muted-foreground">g of carbs now</span>
      </div>
      <p className="text-[11px] text-muted-foreground mt-1">
        Using the {formatTime(calc.bg.timestamp)} reading ({calc.bg.value} mg/dL, {calc.bg.trend.label.toLowerCase()} {calc.bg.trend.arrow}) and{" "}
        {s.bucketLabel.toLowerCase()} settings ({s.bucketHours}).
      </p>

      {d.basalSuppressed ? (
        <p className="mt-3 text-sm text-muted-foreground">
          The only insulin set up in the app is basal, which isn't dosed from carbs or corrections — the calculator suggests nothing.
        </p>
      ) : (
        <div className="mt-3">
          <Line
            op=""
            label="Correct BG"
            value={`${correctionShown > 0 ? "+" : ""}${u(correctionShown)}`}
            sub={
              d.correctionSuppressed
                ? `At/below the ${calc.target} target`
                : held
                  ? `${u(d.correctionHeldUnits)} on hold — recent dose`
                  : `(${calc.bg.value} − ${calc.target}) ÷ ${s.correctionFactor}${Math.abs(d.trendAdjustment) >= 0.005 ? ` · trend ${d.trendAdjLabel}u` : ""}`
            }
            open={open === "correction"}
            onToggle={() => toggle("correction")}
            details={explain("correction", calc)}
          />
          <Line
            op="+"
            label="Carb dose"
            value={`+${u(d.carbInsulin)}`}
            sub={carbs > 0 ? `${carbs} g ÷ ${s.carbRatio}` : "No carbs entered"}
            open={open === "carb"}
            onToggle={() => toggle("carb")}
            details={explain("carb", calc)}
          />
          <Line
            op="+"
            label="Active carbs"
            value={`+${u(d.uncoveredCarbInsulin)}`}
            sub={calc.activeCarbs.totalGrams > 0 ? `${calc.activeCarbs.totalGrams} g still absorbing` : "Nothing absorbing"}
            open={open === "activeCarbs"}
            onToggle={() => toggle("activeCarbs")}
            details={explain("activeCarbs", calc)}
          />
          <Line
            op="−"
            label="Active insulin"
            value={`−${u(held ? 0 : d.iobCredit)}`}
            sub={d.activeInsulinUnits > 0 ? `${u(d.activeInsulinUnits)} on board${d.iobDiscounted ? " · half credited" : ""}` : "None on board"}
            open={open === "activeInsulin"}
            onToggle={() => toggle("activeInsulin")}
            details={explain("activeInsulin", calc)}
          />
          <Line
            op="="
            label="Suggested dose"
            value={u(d.totalDose)}
            sub={[
              Math.abs(d.patternDelta) >= 0.005 ? `pattern ×${d.patternFactor}` : null,
              d.cappedAtMax ? `capped at ${u(d.maxDoseCap)}` : null,
              "rounded to ½u",
            ]
              .filter(Boolean)
              .join(" · ")}
            open={open === "dose"}
            onToggle={() => toggle("dose")}
            details={explain("dose", calc)}
            strong
          />
        </div>
      )}

      {warning && (
        <p
          className={`mt-2 text-[11px] flex items-start gap-1.5 ${warning.level === "info" ? "text-muted-foreground" : "text-amber-600"}`}
        >
          {warning.level === "info" ? <Info className="w-3.5 h-3.5 shrink-0 mt-px" /> : <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />}
          <span>{warning.message}</span>
        </p>
      )}

      <div className="mt-3 pt-3 border-t border-border/60 space-y-1 text-[11px] text-muted-foreground">
        <p>
          <span className="text-foreground font-medium">Settings used:</span> carb ratio 1:{s.carbRatio}
          {s.carbRatio !== calc.base.carbRatio && ` (${s.bucketLabel.toLowerCase()} only; all-day 1:${calc.base.carbRatio})`} · correction 1:
          {s.correctionFactor}
          {s.correctionFactor !== calc.base.correctionFactor && ` (${s.bucketLabel.toLowerCase()} only; all-day 1:${calc.base.correctionFactor})`} ·
          target {calc.target} mg/dL
        </p>
        <p>
          {calc.insulin
            ? `${calc.insulin.name} (${INSULIN_TYPE_LABEL[calc.insulin.type].toLowerCase()}, ${dia / 60} h action)`
            : "Insulin type not set — counted as rapid-acting (4 h action)"}{" "}
          · safety cap {u(d.maxDoseCap)}
          {d.maxDoseCap !== 10 ? " (by weight)" : ""}
          {calc.tuning.factor !== 1 && ` · pattern ×${calc.tuning.factor} from ${calc.tuning.sampleCount} recent doses`}
        </p>
        {calc.defaulted.length > 0 && (
          <p className="text-amber-600">Not saved for this patient, so the app's default is used: {calc.defaulted.join(", ")}.</p>
        )}
        <p>Same math as the app's dose calculator. Click a line to see how it was worked out.</p>
      </div>

      {detail &&
        (done ? (
          <p className="mt-3 text-sm text-success flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" /> {done}
          </p>
        ) : suggesting ? (
          <SuggestChange
            detail={detail}
            calc={calc}
            onDone={(msg) => {
              setDone(msg);
              setSuggesting(false);
            }}
          />
        ) : (
          <button
            onClick={() => setSuggesting(true)}
            className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
          >
            <NotebookPen className="w-4 h-4" /> Suggest a change
          </button>
        ))}
    </div>
  );
}

