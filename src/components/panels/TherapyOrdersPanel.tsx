import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, Clock, Lock, Sliders, CheckCircle2 } from "lucide-react";
import { formatDate, formatTime } from "@/lib/utils";
import type { PatientDetail, TherapyOrder, TherapyOrderValues } from "@/data/contracts";
import { useProposeOrder } from "@/data/doctor-data";

type FieldKey = "carbRatio" | "correctionFactor" | "targetGlucose";

const RANGES: Record<FieldKey, { min: number; max: number; label: string; unit: string }> = {
  carbRatio: { min: 3, max: 50, label: "carb ratio", unit: "g/u" },
  correctionFactor: { min: 10, max: 150, label: "correction factor", unit: "mg/dL per u" },
  targetGlucose: { min: 80, max: 180, label: "target glucose", unit: "mg/dL" },
};

function warnFor(key: FieldKey, raw: string): string | null {
  if (raw.trim() === "") return null;
  const n = Number(raw);
  if (Number.isNaN(n)) return "Enter a number.";
  const r = RANGES[key];
  if (n < r.min || n > r.max) return `Unusual ${r.label} (typical ${r.min}–${r.max}). Double-check before sending.`;
  return null;
}

function num(raw: string): number | undefined {
  const n = Number(raw);
  return raw.trim() === "" || Number.isNaN(n) ? undefined : n;
}

function ValueRow({ label, value, unit }: { label: string; value?: number; unit: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">
        {value ?? "--"} <span className="text-muted-foreground font-normal">{unit}</span>
      </span>
    </div>
  );
}

function PendingBanner({ order }: { order: TherapyOrder }) {
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
      <div className="flex items-center gap-2 text-amber-600 font-medium mb-2">
        <Clock className="w-4 h-4" />
        Pending caregiver confirmation
      </div>
      <p className="text-sm text-muted-foreground mb-3">
        Proposed by {order.proposedByName} on {formatDate(order.proposedAt)} at{" "}
        {formatTime(order.proposedAt)}. It takes effect only after the caregiver confirms it in
        the app.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <ValueRow label="Carb ratio" value={order.carbRatio} unit="g/u" />
        <ValueRow label="Correction" value={order.correctionFactor} unit="mg/dL/u" />
        <ValueRow label="Target" value={order.targetGlucose} unit="mg/dL" />
      </div>
      {order.note && (
        <p className="text-sm text-foreground mt-3 italic">&ldquo;{order.note}&rdquo;</p>
      )}
    </div>
  );
}

export function TherapyOrdersPanel({ detail }: { detail: PatientDetail }) {
  const active = detail.activeOrder;
  const [proposed, setProposed] = useState<TherapyOrder | undefined>(detail.proposedOrder);
  const [carbRatio, setCarbRatio] = useState(String(active?.carbRatio ?? ""));
  const [correctionFactor, setCorrectionFactor] = useState(String(active?.correctionFactor ?? ""));
  const [targetGlucose, setTargetGlucose] = useState(String(active?.targetGlucose ?? ""));
  const [note, setNote] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const { mutate, isPending, error } = useProposeOrder();

  const hasPending = !!proposed;
  const warnings = {
    carbRatio: warnFor("carbRatio", carbRatio),
    correctionFactor: warnFor("correctionFactor", correctionFactor),
    targetGlucose: warnFor("targetGlucose", targetGlucose),
  };
  const changed =
    num(carbRatio) !== active?.carbRatio ||
    num(correctionFactor) !== active?.correctionFactor ||
    num(targetGlucose) !== active?.targetGlucose;
  const canSubmit = detail.canPrescribe && !hasPending && changed && note.trim().length > 0 && !isPending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    const values: TherapyOrderValues = {
      carbRatio: num(carbRatio),
      correctionFactor: num(correctionFactor),
      targetGlucose: num(targetGlucose),
      insulinTypes: active?.insulinTypes,
      alertThresholds: active?.alertThresholds,
    };
    try {
      const order = await mutate({
        patientId: detail.patientId,
        baseVersion: active?.version ?? 0,
        values,
        note: note.trim(),
      });
      setProposed(order);
      setNote("");
      setFeedback("Change proposed — sent to the caregiver to confirm in the app.");
    } catch {
      /* error surfaced via `error` below */
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div data-tour="treatment">
        <h2 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
          <Sliders className="w-6 h-6 text-primary" />
          Treatment settings
        </h2>
        <p className="text-muted-foreground text-sm mt-1">
          These settings drive dosing in the patient's app. Changes are proposed, then take effect
          only after the caregiver confirms them.
        </p>
      </div>

      {feedback && (
        <div className="rounded-xl border border-success/30 bg-success/10 p-3 flex items-center gap-2 text-success">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span className="text-sm">{feedback}</span>
        </div>
      )}

      {proposed && <PendingBanner order={proposed} />}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <span>Active orders</span>
            {active && (
              <span className="text-xs font-normal text-muted-foreground">
                v{active.version} · acknowledged {active.acknowledgedAt ? formatDate(active.acknowledgedAt) : "—"}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <ValueRow label="Carb ratio" value={active?.carbRatio} unit="g/u" />
          <ValueRow label="Correction" value={active?.correctionFactor} unit="mg/dL/u" />
          <ValueRow label="Target" value={active?.targetGlucose} unit="mg/dL" />
        </CardContent>
      </Card>

      {!detail.canPrescribe ? (
        <div className="rounded-xl border border-border bg-secondary/30 p-4 flex items-start gap-3">
          <Lock className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground">
            You can view these orders, but only the designated prescriber for this patient can
            change them.
          </p>
        </div>
      ) : hasPending ? (
        <div className="rounded-xl border border-border bg-secondary/30 p-4 text-sm text-muted-foreground">
          A change is already awaiting caregiver confirmation. You can propose another once it's
          resolved.
        </div>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Propose a change</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 mb-5 flex items-start gap-2 text-amber-600">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <p className="text-xs">
                Proposed changes are not applied automatically. The caregiver must confirm them in
                the Glucose Guardian app before they affect dosing.
              </p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Field
                  id="carbRatio"
                  label="Carb ratio (g/u)"
                  value={carbRatio}
                  onChange={setCarbRatio}
                  warning={warnings.carbRatio}
                />
                <Field
                  id="correctionFactor"
                  label="Correction (mg/dL per u)"
                  value={correctionFactor}
                  onChange={setCorrectionFactor}
                  warning={warnings.correctionFactor}
                />
                <Field
                  id="targetGlucose"
                  label="Target (mg/dL)"
                  value={targetGlucose}
                  onChange={setTargetGlucose}
                  warning={warnings.targetGlucose}
                />
              </div>

              <div>
                <Label htmlFor="note">Reason for change (required)</Label>
                <Textarea
                  id="note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Repeated post-dinner highs; tightening evening carb ratio."
                  className="mt-1.5"
                  rows={3}
                />
              </div>

              {error && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 flex items-start gap-2 text-destructive">
                  <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                  <span className="text-sm">{error.message}</span>
                </div>
              )}

              <div className="flex items-center justify-between gap-4">
                <p className="text-xs text-muted-foreground">
                  Sends to the caregiver for confirmation. Nothing changes on the device until they
                  accept.
                </p>
                <Button type="submit" disabled={!canSubmit}>
                  {isPending ? "Proposing…" : "Propose change"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  warning,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  warning: string | null;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5"
      />
      {warning && (
        <p className="text-xs text-amber-600 mt-1 flex items-start gap-1">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          {warning}
        </p>
      )}
    </div>
  );
}
