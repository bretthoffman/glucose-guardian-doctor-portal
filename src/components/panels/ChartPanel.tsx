import { useMemo, useState } from "react";
import type { PatientSnapshot } from "@doctor-portal/api-client-react";
import { computeMetrics, STATUS_META, zonesFromSnapshot } from "@/lib/glucose-metrics";
import { GlucoseChart } from "@/components/GlucoseChart";
import { calculateA1C } from "@/lib/utils";

const RANGES = [
  { id: "3h", label: "3H", hours: 3 },
  { id: "6h", label: "6H", hours: 6 },
  { id: "12h", label: "12H", hours: 12 },
  { id: "24h", label: "24H", hours: 24 },
  { id: "7d", label: "7D", hours: 24 * 7 },
];

function StatTile({
  label,
  value,
  unit,
  accent,
  sub,
}: {
  label: string;
  value: string;
  unit?: string;
  accent?: string;
  sub?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={`text-2xl font-display font-bold ${accent ?? "text-foreground"}`}>
        {value}
        {unit && <span className="text-sm font-normal text-muted-foreground ml-1">{unit}</span>}
      </p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function RangeBar({
  segments,
}: {
  segments: { key: string; pct: number; hex: string; label: string }[];
}) {
  return (
    <div>
      <div className="flex h-4 w-full overflow-hidden rounded-full border border-border">
        {segments.map((s) =>
          s.pct > 0 ? (
            <div
              key={s.key}
              style={{ width: `${s.pct}%`, backgroundColor: s.hex }}
              title={`${s.label}: ${s.pct}%`}
            />
          ) : null,
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4">
        {segments.map((s) => (
          <div key={s.key} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: s.hex }} />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{s.pct}%</p>
              <p className="text-[11px] text-muted-foreground truncate">{s.label}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ChartPanel({ data }: { data: PatientSnapshot }) {
  const [rangeId, setRangeId] = useState("24h");
  const zones = zonesFromSnapshot(data);
  const all = useMemo(() => computeMetrics(data).readingsAsc, [data]);
  const range = RANGES.find((r) => r.id === rangeId) ?? RANGES[3];

  const filtered = useMemo(() => {
    if (!all.length) return [];
    const newest = new Date(all[all.length - 1].timestamp).getTime();
    const cutoff = newest - range.hours * 3600 * 1000;
    return all.filter((r) => new Date(r.timestamp).getTime() >= cutoff);
  }, [all, range]);

  const vals = filtered.map((r) => r.value);
  const n = vals.length;
  const pct = (c: number) => (n ? Math.round((c / n) * 100) : 0);
  const avg = n ? Math.round(vals.reduce((a, b) => a + b, 0) / n) : null;
  const a1c = n ? calculateA1C(filtered) : null;
  const highest = n ? Math.max(...vals) : null;
  const lowest = n ? Math.min(...vals) : null;

  const tir = pct(vals.filter((v) => v >= zones.low && v <= zones.high).length);
  const tar = pct(vals.filter((v) => v > zones.high).length);
  const tbr = pct(vals.filter((v) => v < zones.low).length);

  const segments = [
    {
      key: "vhigh",
      pct: pct(vals.filter((v) => v >= zones.urgentHigh).length),
      hex: STATUS_META.urgentHigh.hex,
      label: `Very High (≥${zones.urgentHigh})`,
    },
    {
      key: "high",
      pct: pct(vals.filter((v) => v > zones.high && v < zones.urgentHigh).length),
      hex: STATUS_META.high.hex,
      label: `High (${zones.high}–${zones.urgentHigh})`,
    },
    {
      key: "target",
      pct: pct(vals.filter((v) => v >= zones.low && v <= zones.high).length),
      hex: STATUS_META.target.hex,
      label: `Target (${zones.low}–${zones.high})`,
    },
    {
      key: "low",
      pct: pct(vals.filter((v) => v > zones.urgentLow && v < zones.low).length),
      hex: STATUS_META.low.hex,
      label: `Low (${zones.urgentLow}–${zones.low})`,
    },
    {
      key: "vlow",
      pct: pct(vals.filter((v) => v <= zones.urgentLow).length),
      hex: STATUS_META.urgentLow.hex,
      label: `Very Low (≤${zones.urgentLow})`,
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-display font-bold text-foreground">Glucose History</h2>
          <p className="text-sm text-muted-foreground">
            {n} readings over the last {range.label.toLowerCase()}
          </p>
        </div>
        <div className="flex items-center gap-1 bg-card border border-border rounded-xl p-1">
          {RANGES.map((r) => (
            <button
              key={r.id}
              onClick={() => setRangeId(r.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                r.id === rangeId
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatTile label="Average" value={avg != null ? `${avg}` : "--"} unit="mg/dL" />
        <StatTile
          label="Est. A1C / GMI"
          value={a1c ? `${a1c}` : "--"}
          unit="%"
          accent={a1c && Number(a1c) > 7 ? "text-warning" : "text-foreground"}
        />
        <StatTile
          label="Time in Range"
          value={`${tir}`}
          unit="%"
          accent={tir >= 70 ? "text-success" : tir >= 50 ? "text-warning" : "text-destructive"}
        />
        <StatTile label="Highest" value={highest != null ? `${highest}` : "--"} accent="text-warning" />
        <StatTile label="Lowest" value={lowest != null ? `${lowest}` : "--"} accent="text-orange-500" />
      </div>

      <div className="bg-card border border-border rounded-2xl p-5">
        <h3 className="font-medium text-foreground mb-4">Continuous Glucose Monitor</h3>
        <GlucoseChart readings={filtered} zones={zones} height={400} />
      </div>

      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium text-foreground">Time in Ranges</h3>
          <span className="text-xs text-muted-foreground">
            {tar}% above · {tir}% in range · {tbr}% below
          </span>
        </div>
        {n ? (
          <RangeBar segments={segments} />
        ) : (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No readings in this window.
          </p>
        )}
      </div>
    </div>
  );
}
