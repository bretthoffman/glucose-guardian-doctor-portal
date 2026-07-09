import { Bell, CheckCircle2, Clock, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate, formatTime } from "@/lib/utils";
import type { PatientDetail } from "@/data/contracts";

function ChangeStat({ label, value, unit }: { label: string; value?: number; unit: string }) {
  if (value == null) return null;
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">
        {value} <span className="text-muted-foreground font-normal">{unit}</span>
      </span>
    </div>
  );
}

/**
 * Per-patient notification feed: treatment changes this doctor proposed and the caregiver's
 * approve/decline decisions. The caregiver's action is the "notification" (badged in the nav and
 * on the patient list); the pending proposal is shown for context.
 */
export function NotificationsPanel({
  detail,
  patientName,
}: {
  detail: PatientDetail;
  patientName: string;
}) {
  const pending = detail.proposedOrder;
  const decision = detail.lastDecision;
  const hasAny = !!pending || !!decision;

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h2 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
          <Bell className="w-6 h-6 text-primary" />
          Notifications
        </h2>
        <p className="text-muted-foreground text-sm mt-1">
          Updates from {patientName}'s caregiver — treatment changes you proposed and their
          decisions.
        </p>
      </div>

      {!hasAny && (
        <Card>
          <CardContent className="py-12 text-center">
            <Bell className="w-8 h-8 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              Nothing new. When you propose a treatment change, the caregiver's approval or decline
              shows up here.
            </p>
          </CardContent>
        </Card>
      )}

      {decision && (
        <Card
          className={
            decision.status === "approved" ? "border-success/30" : "border-amber-500/30"
          }
        >
          <CardContent className="p-4 flex items-start gap-3">
            {decision.status === "approved" ? (
              <CheckCircle2 className="w-5 h-5 text-success shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            )}
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">
                Caregiver {decision.status === "approved" ? "approved" : "declined"} your treatment
                change
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {formatDate(decision.decidedAt)} at {formatTime(decision.decidedAt)}
                {decision.status === "approved"
                  ? " · the new settings are now driving dosing in the app."
                  : " · current settings stay in place."}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {pending && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <div className="flex items-center gap-2 text-amber-600 font-medium">
            <Clock className="w-4 h-4" /> Awaiting caregiver confirmation
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            You proposed a change on {formatDate(pending.proposedAt)} at{" "}
            {formatTime(pending.proposedAt)}. It takes effect only after the caregiver confirms it in
            the app.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
            <ChangeStat label="Carb ratio" value={pending.carbRatio} unit="g/u" />
            <ChangeStat label="Correction" value={pending.correctionFactor} unit="mg/dL/u" />
            <ChangeStat label="Target" value={pending.targetGlucose} unit="mg/dL" />
          </div>
          {pending.note && (
            <p className="text-sm text-foreground italic mt-3">&ldquo;{pending.note}&rdquo;</p>
          )}
        </div>
      )}
    </div>
  );
}
