import type { ReactNode } from "react";
import { useLocation } from "wouter";
import {
  ArrowRight,
  ArrowUp,
  ArrowDown,
  ArrowUpRight,
  ArrowDownRight,
  Bell,
  Clock,
  SlidersHorizontal,
  Sparkles,
  Syringe,
  MessageSquare,
  Stethoscope,
  User,
} from "lucide-react";
import type { PatientSnapshot } from "@doctor-portal/api-client-react";
import { formatTime, getGlucoseColor } from "@/lib/utils";
import {
  computeMetrics,
  detectPatterns,
  formatAge,
  isToday,
  STATUS_META,
  glucoseStatus,
  TREND_LABEL,
} from "@/lib/glucose-metrics";
import { GlucoseChart } from "@/components/GlucoseChart";

function TrendIcon({ trend, className = "w-4 h-4" }: { trend: string; className?: string }) {
  switch (trend) {
    case "DoubleUp":
    case "SingleUp":
      return <ArrowUp className={className} />;
    case "FortyFiveUp":
      return <ArrowUpRight className={className} />;
    case "FortyFiveDown":
      return <ArrowDownRight className={className} />;
    case "SingleDown":
    case "DoubleDown":
      return <ArrowDown className={className} />;
    default:
      return <ArrowRight className={className} />;
  }
}

function Ring({ pct }: { pct: number }) {
  const r = 18;
  const c = 2 * Math.PI * r;
  const tone = pct >= 70 ? "#10B981" : pct >= 50 ? "#F59E0B" : "#EF4444";
  return (
    <svg width="46" height="46" viewBox="0 0 46 46" className="shrink-0">
      <circle cx="23" cy="23" r={r} fill="none" stroke="hsl(215 25% 27%)" strokeWidth="5" />
      <circle
        cx="23"
        cy="23"
        r={r}
        fill="none"
        stroke={tone}
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - Math.min(100, pct) / 100)}
        transform="rotate(-90 23 23)"
      />
    </svg>
  );
}

function Kpi({
  label,
  children,
  foot,
  right,
}: {
  label: string;
  children: ReactNode;
  foot?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <p className="text-xs text-muted-foreground mb-1.5">{label}</p>
      <div className="flex items-end justify-between gap-2">
        <div className="min-w-0">{children}</div>
        {right}
      </div>
      {foot && <div className="text-xs text-muted-foreground mt-1.5">{foot}</div>}
    </div>
  );
}

function SectionCard({
  title,
  icon: Icon,
  action,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/60">
        <h3 className="font-medium text-foreground flex items-center gap-2">
          <Icon className="w-4 h-4 text-primary" />
          {title}
        </h3>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function QuickStat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`text-lg font-display font-bold ${accent ?? "text-foreground"}`}>{value}</p>
    </div>
  );
}

export function OverviewPanel({ data, accessCode }: { data: PatientSnapshot; accessCode: string }) {
  const [, setLocation] = useLocation();
  const m = computeMetrics(data);
  const z = m.zones;
  const p = data.profile;
  const patterns = detectPatterns(data);
  const status = m.status ? STATUS_META[m.status] : null;
  const a1cNum = m.a1c ? Number(m.a1c) : null;
  const go = (tab: string) => setLocation(`/patient/${accessCode}/${tab}`);
  const editLink = (
    <button onClick={() => go("orders")} className="text-xs text-primary hover:underline">
      Edit
    </button>
  );

  const messages = data.messages ?? [];
  const recentReadings = [...m.readingsAsc].reverse().slice(0, 6);
  const todayInsulin = (data.insulinLog ?? [])
    .filter((l) => isToday(l.timestamp))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return (
    <div className="space-y-5">
      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Kpi
          label="Current Glucose"
          foot={
            !m.latest ? (
              "No data"
            ) : m.stale && m.minutesSinceLatest != null ? (
              <span className="flex items-center gap-1 text-amber-600">
                <Clock className="w-3.5 h-3.5" />
                {formatAge(m.minutesSinceLatest)} · may be outdated
              </span>
            ) : status ? (
              <span className={`flex items-center gap-1 ${status.text}`}>
                <TrendIcon trend={m.latest.trend} className="w-3.5 h-3.5" />
                {TREND_LABEL[m.latest.trend] ?? "Flat"} · {status.label}
              </span>
            ) : undefined
          }
        >
          <span
            className={`text-3xl font-display font-bold ${
              m.stale ? "text-muted-foreground" : (status?.text ?? "text-foreground")
            }`}
          >
            {m.latest?.value ?? "--"}
          </span>
          <span className="text-sm text-muted-foreground ml-1">mg/dL</span>
        </Kpi>

        <Kpi
          label="Estimated A1C (7d)"
          foot="Goal: < 7.0%"
          right={
            a1cNum != null ? (
              <span
                className={`text-xs px-2 py-0.5 rounded-full border ${
                  a1cNum > 7 ? STATUS_META.high.chip : STATUS_META.target.chip
                }`}
              >
                {a1cNum > 7 ? "High" : "On target"}
              </span>
            ) : undefined
          }
        >
          <span className="text-3xl font-display font-bold text-foreground">
            {m.a1c ? `${m.a1c}%` : "--"}
          </span>
        </Kpi>

        <Kpi label="Time in Range (24h)" foot="Goal: > 70%" right={<Ring pct={m.tir} />}>
          <span className="text-3xl font-display font-bold text-foreground">{m.tir}%</span>
        </Kpi>

        <Kpi label="Insulin Today" foot="Total dose">
          <span className="text-3xl font-display font-bold text-foreground">
            {m.insulinToday.toFixed(1)}
          </span>
          <span className="text-sm text-muted-foreground ml-1">u</span>
        </Kpi>

        <Kpi label="Time Above Range" foot="Goal: < 25%">
          <span
            className={`text-3xl font-display font-bold ${
              m.tar > 25 ? "text-destructive" : "text-foreground"
            }`}
          >
            {m.tar}%
          </span>
        </Kpi>
      </div>

      {/* Chart + utility column */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-foreground">Continuous Glucose Monitor</h3>
            <button
              onClick={() => go("chart")}
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              Full chart <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-5">
            <QuickStat label="Average" value={m.average != null ? `${m.average}` : "--"} />
            <QuickStat label="Highest" value={m.highest != null ? `${m.highest}` : "--"} accent="text-warning" />
            <QuickStat label="Lowest" value={m.lowest != null ? `${m.lowest}` : "--"} accent="text-orange-500" />
            <QuickStat
              label="Variability"
              value={m.variability}
              accent={m.variability === "High" ? "text-warning" : "text-foreground"}
            />
            <QuickStat
              label="Sensor Usage"
              value={m.sensorUsage != null ? `${m.sensorUsage}%` : "--"}
            />
          </div>
          <GlucoseChart readings={m.readingsAsc} zones={z} height={300} />
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-4 text-xs text-muted-foreground">
            <Legend hex={STATUS_META.target.hex} label={`Target ${z.low}–${z.high}`} />
            <Legend hex={STATUS_META.high.hex} label={`High ${z.high}–${z.urgentHigh}`} />
            <Legend hex={STATUS_META.urgentHigh.hex} label={`Urgent >${z.urgentHigh}`} />
            <Legend hex={STATUS_META.low.hex} label={`Low <${z.low}`} />
          </div>
        </div>

        <div className="space-y-5">
          <SectionCard title="Alert Thresholds" icon={Bell} action={editLink}>
            <div className="space-y-2.5">
              <ThresholdRow label="Urgent High" value={`> ${z.urgentHigh}`} tone="text-destructive" />
              <ThresholdRow label="High" value={`${z.high}–${z.urgentHigh}`} tone="text-warning" />
              <ThresholdRow label="Target Range" value={`${z.low}–${z.high}`} tone="text-success" />
              <ThresholdRow label="Low" value={`< ${z.low}`} tone="text-orange-500" />
              <ThresholdRow label="Urgent Low" value={`< ${z.urgentLow}`} tone="text-destructive" />
            </div>
          </SectionCard>

          <SectionCard title="Ratios & Factors" icon={SlidersHorizontal} action={editLink}>
            <div className="space-y-2.5 text-sm">
              <KeyVal label="Carb Ratio" value={`1u : ${p.carbRatio ?? "--"}g`} />
              <KeyVal label="Correction Factor" value={`1u : ${p.correctionFactor ?? "--"} mg/dL`} />
              <KeyVal label="Target Glucose" value={`${p.targetGlucose ?? "--"} mg/dL`} />
            </div>
          </SectionCard>

          <SectionCard title="Detected Patterns" icon={Sparkles}>
            <ul className="space-y-2.5">
              {patterns.map((pat) => (
                <li key={pat} className="flex items-start gap-2 text-sm text-foreground">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                  {pat}
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>
      </div>

      {/* Lower cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <SectionCard
          title="Recent Readings"
          icon={Stethoscope}
          action={
            <button onClick={() => go("chart")} className="text-xs text-primary hover:underline">
              View all
            </button>
          }
        >
          {recentReadings.length ? (
            <div className="space-y-1">
              {recentReadings.map((r, i) => {
                const meta = STATUS_META[glucoseStatus(r.value, z)];
                return (
                  <div key={i} className="flex items-center justify-between py-1.5 text-sm">
                    <span className="text-muted-foreground">{formatTime(r.timestamp)}</span>
                    <span className={`flex items-center gap-1 ${meta.text}`}>
                      <TrendIcon trend={r.trend} className="w-3.5 h-3.5" />
                    </span>
                    <span
                      className={`font-medium px-2 py-0.5 rounded-full text-xs ${getGlucoseColor(r.value)}`}
                    >
                      {r.value}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">No readings yet.</p>
          )}
        </SectionCard>

        <SectionCard
          title="Insulin Log (Today)"
          icon={Syringe}
          action={
            <button onClick={() => go("insulin")} className="text-xs text-primary hover:underline">
              View all
            </button>
          }
        >
          {todayInsulin.length ? (
            <div className="space-y-2.5">
              {todayInsulin.slice(0, 4).map((l) => (
                <div key={l.id} className="flex items-center justify-between text-sm">
                  <div className="min-w-0">
                    <span className="font-medium text-primary">{l.units}u</span>
                    <span className="text-muted-foreground ml-2 capitalize">{l.type}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{formatTime(l.timestamp)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">No insulin logged today.</p>
          )}
        </SectionCard>

        <SectionCard
          title="Recent Messages"
          icon={MessageSquare}
          action={
            <button onClick={() => go("messages")} className="text-xs text-primary hover:underline">
              View all
            </button>
          }
        >
          {messages.length ? (
            <div className="space-y-3">
              {messages.slice(-3).map((msg) => (
                <div key={msg.id} className="flex items-start gap-2.5">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                      msg.sender === "doctor" ? "bg-primary" : "bg-secondary border border-border"
                    }`}
                  >
                    {msg.sender === "doctor" ? (
                      <Stethoscope className="w-3.5 h-3.5 text-primary-foreground" />
                    ) : (
                      <User className="w-3.5 h-3.5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-foreground line-clamp-2">{msg.text}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {msg.sender === "doctor" ? "You" : "Caregiver"} · {formatTime(msg.timestamp)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">No messages yet.</p>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

function Legend({ hex, label }: { hex: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: hex }} />
      {label}
    </span>
  );
}

function ThresholdRow({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="flex items-center gap-2 text-muted-foreground">
        <span className={`w-1.5 h-1.5 rounded-full ${tone.replace("text-", "bg-")}`} />
        {label}
      </span>
      <span className={`font-medium ${tone}`}>{value}</span>
    </div>
  );
}

function KeyVal({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}
