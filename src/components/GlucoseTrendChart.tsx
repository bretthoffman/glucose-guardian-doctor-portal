import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceArea,
  Customized,
} from "recharts";
import type { CGMReading } from "@doctor-portal/api-client-react";
import { glucoseStatus, STATUS_META, type GlucoseZones } from "@/lib/glucose-metrics";

function formatDateTick(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

interface TooltipProps {
  active?: boolean;
  payload?: { value: number; dataKey: string; payload: { ts: number; value: number } }[];
  zones: GlucoseZones;
}

function ChartTooltip({ active, payload, zones }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  const meta = STATUS_META[glucoseStatus(point.value, zones)];
  return (
    <div className="bg-card border border-border rounded-xl px-3 py-2 shadow-xl">
      <p className="text-xs text-muted-foreground">
        {new Date(point.ts).toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })}
      </p>
      <p className={`text-xl font-display font-bold ${meta.text}`}>
        {point.value} <span className="text-xs font-normal text-muted-foreground">mg/dL</span>
      </p>
      <p className={`text-xs ${meta.text}`}>{meta.label}</p>
    </div>
  );
}

/**
 * A1C-focused "Glucose Over Time" chart: glucose line, smoothed average-glucose line, five
 * clinical zone bands (Very High / High / Target / Low / Very Low) with calm right-edge labels.
 */
export function GlucoseTrendChart({
  readings,
  zones,
  domain,
  height = 380,
}: {
  readings: CGMReading[];
  zones: GlucoseZones;
  domain: [number, number];
  height?: number;
}) {
  const base = readings
    .map((r) => ({ ts: new Date(r.timestamp).getTime(), value: r.value }))
    .filter((d) => d.ts >= domain[0] && d.ts <= domain[1])
    .sort((a, b) => a.ts - b.ts);

  // Smoothed average-glucose trend line (centered moving average).
  const win = Math.max(2, Math.floor(base.length / 24));
  const data = base.map((d, i) => {
    const lo = Math.max(0, i - win);
    const hi = Math.min(base.length - 1, i + win);
    let sum = 0;
    for (let j = lo; j <= hi; j++) sum += base[j].value;
    return { ...d, avg: Math.round(sum / (hi - lo + 1)) };
  });

  const peak = Math.max(400, ...data.map((d) => d.value));
  const yMax = Math.ceil((peak + 10) / 50) * 50;

  const xTicks: number[] = [];
  for (let i = 0; i <= 6; i++) xTicks.push(domain[0] + ((domain[1] - domain[0]) * i) / 6);

  const bands = [
    { y1: zones.urgentHigh, y2: yMax, hex: STATUS_META.urgentHigh.hex, range: `> ${zones.urgentHigh}`, label: "Very High", op: 0.1 },
    { y1: zones.high, y2: zones.urgentHigh, hex: STATUS_META.high.hex, range: `${zones.high + 1} – ${zones.urgentHigh}`, label: "High", op: 0.1 },
    { y1: zones.low, y2: zones.high, hex: STATUS_META.target.hex, range: `${zones.low} – ${zones.high}`, label: "Target", op: 0.14 },
    { y1: zones.urgentLow, y2: zones.low, hex: STATUS_META.low.hex, range: `${zones.urgentLow} – ${zones.low - 1}`, label: "Low", op: 0.1 },
    { y1: 40, y2: zones.urgentLow, hex: STATUS_META.urgentHigh.hex, range: `< ${zones.urgentLow}`, label: "Very Low", op: 0.1 },
  ];

  const renderZoneLabels = (cprops: Record<string, unknown>) => {
    const yAxisMap = cprops.yAxisMap as Record<string, { scale: (v: number) => number }> | undefined;
    const offset = cprops.offset as { left: number; width: number } | undefined;
    if (!yAxisMap || !offset) return <g />;
    const scale = Object.values(yAxisMap)[0]?.scale;
    if (!scale) return <g />;
    const x = offset.left + offset.width + 10;
    return (
      <g>
        {bands.map((b) => {
          const y = scale((b.y1 + b.y2) / 2);
          return (
            <g key={b.label}>
              <text x={x} y={y - 4} fontSize={11} fill="hsl(215 16% 65%)">
                {b.range}
              </text>
              <text x={x} y={y + 9} fontSize={11} fontWeight={600} fill={b.hex}>
                {b.label}
              </text>
            </g>
          );
        })}
      </g>
    );
  };

  if (!data.length) {
    return (
      <div
        className="flex items-center justify-center text-muted-foreground border-2 border-dashed border-border rounded-xl"
        style={{ height }}
      >
        No CGM readings in this range.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 10, right: 92, left: -4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(215 25% 27%)" vertical={false} />
        {bands.map((b) => (
          <ReferenceArea key={b.label} y1={b.y1} y2={b.y2} fill={b.hex} fillOpacity={b.op} />
        ))}
        <XAxis
          type="number"
          dataKey="ts"
          domain={domain}
          ticks={xTicks}
          tickFormatter={formatDateTick}
          stroke="hsl(215 16% 65%)"
          fontSize={11}
          tickMargin={8}
        />
        <YAxis
          domain={[40, yMax]}
          ticks={[40, 100, 200, 300, yMax >= 400 ? 400 : yMax]}
          stroke="hsl(215 16% 65%)"
          fontSize={11}
          tickMargin={6}
          width={40}
        />
        <Tooltip content={(p) => <ChartTooltip {...(p as object)} zones={zones} />} />
        <Line
          type="monotone"
          dataKey="value"
          name="Glucose (mg/dL)"
          stroke="hsl(217 91% 60%)"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="avg"
          name="Average Glucose"
          stroke="#93C5FD"
          strokeWidth={1.5}
          strokeDasharray="6 5"
          dot={false}
          isAnimationActive={false}
        />
        <Customized component={renderZoneLabels} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
