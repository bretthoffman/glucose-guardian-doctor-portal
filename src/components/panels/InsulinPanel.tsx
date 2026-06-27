import type { InsulinLogEntryType, PatientSnapshot } from "@doctor-portal/api-client-react";
import { Syringe, Utensils, Camera } from "lucide-react";
import { formatTime, formatDate } from "@/lib/utils";
import { computeMetrics, isToday } from "@/lib/glucose-metrics";

const TYPE_TAG: Record<InsulinLogEntryType, string> = {
  bolus: "bg-primary/15 text-primary border-primary/30",
  correction: "bg-warning/15 text-warning border-warning/30",
  manual: "bg-secondary text-muted-foreground border-border",
};

function Tile({
  label,
  value,
  unit,
  sub,
}: {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-2xl font-display font-bold text-foreground">
        {value}
        {unit && <span className="text-sm font-normal text-muted-foreground ml-1">{unit}</span>}
      </p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5 truncate">{sub}</p>}
    </div>
  );
}

export function InsulinPanel({ data }: { data: PatientSnapshot }) {
  const m = computeMetrics(data);
  const logs = [...(data.insulinLog ?? [])].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
  const meals = [...(data.foodLog ?? [])].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
  const foodById = new Map(meals.map((f) => [f.id, f]));

  const bolusCount = logs.filter((l) => l.type === "bolus").length;
  const correctionCount = logs.filter((l) => l.type === "correction").length;
  const dosesToday = logs.filter((l) => isToday(l.timestamp)).length;
  const lastMeal = meals[0];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Tile
          label="Total Today"
          value={m.insulinToday.toFixed(1)}
          unit="u"
          sub={`${dosesToday} dose${dosesToday === 1 ? "" : "s"}`}
        />
        <Tile
          label="Last Dose"
          value={m.lastInsulin ? `${m.lastInsulin.units}` : "--"}
          unit={m.lastInsulin ? "u" : undefined}
          sub={m.lastInsulin ? formatTime(m.lastInsulin.timestamp) : "No doses logged"}
        />
        <Tile label="Bolus" value={`${bolusCount}`} sub="logged" />
        <Tile label="Correction" value={`${correctionCount}`} sub="logged" />
        <Tile
          label="Last Meal"
          value={lastMeal ? `${lastMeal.estimatedCarbs}` : "--"}
          unit={lastMeal ? "g" : undefined}
          sub={lastMeal ? lastMeal.foodName : "No meals logged"}
        />
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border/60">
          <Syringe className="w-4 h-4 text-primary" />
          <h3 className="font-medium text-foreground">Insulin Delivery Log</h3>
        </div>
        {logs.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-secondary/40">
                <tr>
                  <th className="px-5 py-3 font-medium">Date &amp; Time</th>
                  <th className="px-5 py-3 font-medium">Units</th>
                  <th className="px-5 py-3 font-medium">Type</th>
                  <th className="px-5 py-3 font-medium">Context</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const meal = log.foodLogId ? foodById.get(log.foodLogId) : undefined;
                  return (
                    <tr
                      key={log.id}
                      className="border-t border-border/50 hover:bg-secondary/20 transition-colors"
                    >
                      <td className="px-5 py-3 whitespace-nowrap">
                        <div className="font-medium text-foreground">{formatTime(log.timestamp)}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatDate(log.timestamp)}
                        </div>
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        <span className="text-lg font-display font-bold text-primary">
                          {log.units}
                        </span>
                        <span className="text-muted-foreground ml-1 text-xs">u</span>
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`capitalize px-2.5 py-1 rounded-full text-xs font-medium border ${TYPE_TAG[log.type]}`}
                        >
                          {log.type}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground max-w-xs truncate">
                        {meal ? (
                          <span className="inline-flex items-center gap-1.5">
                            <Utensils className="w-3.5 h-3.5" />
                            {meal.foodName} · {meal.estimatedCarbs}g
                          </span>
                        ) : (
                          log.note || "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-12 text-center">
            No insulin doses recorded yet.
          </p>
        )}
      </div>

      {meals.length > 0 && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border/60">
            <Utensils className="w-4 h-4 text-primary" />
            <h3 className="font-medium text-foreground">Recent Meals</h3>
          </div>
          <div className="divide-y divide-border/50">
            {meals.slice(0, 6).map((meal) => (
              <div key={meal.id} className="flex items-center gap-4 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground flex items-center gap-1.5">
                    {meal.foodName}
                    {meal.fromPhoto && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground border border-border rounded-full px-1.5 py-0.5">
                        <Camera className="w-3 h-3" /> Photo
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(meal.timestamp)} · {formatTime(meal.timestamp)}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-foreground">{meal.estimatedCarbs}g carbs</p>
                  <p className="text-xs text-muted-foreground">{meal.insulinUnits}u given</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
