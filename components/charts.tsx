import { cx } from "@/components/ui";

/* ──────────────────────────────────────────────────────────────
   Lightweight inline-SVG charts. Pure presentational, server-safe.
   Colors accept CSS color strings (incl. var(--color-*)).
   ────────────────────────────────────────────────────────────── */

/** Tiny sparkline for KPI tiles. */
export function Sparkline({
  points,
  color = "var(--color-navy)",
  className,
  width = 120,
  height = 36,
}: {
  points: number[];
  color?: string;
  className?: string;
  width?: number;
  height?: number;
}) {
  const max = Math.max(...points);
  const min = Math.min(...points);
  const span = max - min || 1;
  const step = width / (points.length - 1);
  const d = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)} ${(height - ((p - min) / span) * height).toFixed(1)}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={className} fill="none" preserveAspectRatio="none">
      <path d={d} stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Filled area sparkline (e.g. wallet "spent this month"). */
export function AreaSpark({
  points,
  color = "var(--color-crimson)",
  className,
  width = 240,
  height = 72,
}: {
  points: number[];
  color?: string;
  className?: string;
  width?: number;
  height?: number;
}) {
  const max = Math.max(...points);
  const min = Math.min(...points);
  const span = max - min || 1;
  const step = width / (points.length - 1);
  const coords = points.map((p, i) => [i * step, height - ((p - min) / span) * (height - 6) - 3]);
  const line = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${line} L${width} ${height} L0 ${height} Z`;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={className} fill="none" preserveAspectRatio="none">
      <path d={area} fill={color} opacity={0.12} />
      <path d={line} stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Stacked vertical bar chart (admin: volume by category). */
export function StackedBars({
  data,
  colors,
  labels,
  className,
  height = 220,
}: {
  data: number[][]; // per bar: [seg1, seg2, ...]
  colors: string[];
  labels?: string[];
  className?: string;
  height?: number;
}) {
  const totals = data.map((d) => d.reduce((a, b) => a + b, 0));
  const max = Math.max(...totals) || 1;
  return (
    <div className={className}>
      <div className="flex items-end justify-between gap-2" style={{ height }}>
        {data.map((segs, i) => {
          const total = totals[i];
          const barH = (total / max) * height;
          return (
            <div key={i} className="flex flex-1 flex-col items-center gap-2">
              <div
                className="flex w-full max-w-[34px] flex-col-reverse overflow-hidden rounded-[4px]"
                style={{ height: barH }}
              >
                {segs.map((v, s) => (
                  <div key={s} style={{ height: `${(v / total) * 100}%`, background: colors[s] }} />
                ))}
              </div>
              {labels && <span className="font-mono text-[0.6rem] text-faint">{labels[i]}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Donut / ring chart (admin: GWP by underwriter). */
export function Donut({
  segments,
  size = 180,
  thickness = 26,
  className,
}: {
  segments: { label: string; value: number; color: string }[];
  size?: number;
  thickness?: number;
  className?: string;
}) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  // Pre-compute each arc's length and start offset (no mutation during render).
  const arcs = segments.reduce<{ dash: number; offset: number; color: string }[]>((acc, s) => {
    const prev = acc[acc.length - 1];
    const offset = prev ? prev.offset + prev.dash : 0;
    acc.push({ dash: (s.value / total) * c, offset, color: s.color });
    return acc;
  }, []);
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className={className} width={size} height={size}>
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        {arcs.map((a, i) => (
          <circle
            key={i}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={a.color}
            strokeWidth={thickness}
            strokeDasharray={`${a.dash} ${c - a.dash}`}
            strokeDashoffset={-a.offset}
          />
        ))}
      </g>
    </svg>
  );
}

/** Horizontal progress bar (admin: float by bank, SLA meters). */
export function ProgressBar({
  value,
  max = 100,
  color = "var(--color-navy)",
  trackClassName,
  className,
  height = 8,
}: {
  value: number;
  max?: number;
  color?: string;
  trackClassName?: string;
  className?: string;
  height?: number;
}) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div
      className={cx("w-full overflow-hidden rounded-full bg-line-soft", trackClassName, className)}
      style={{ height }}
    >
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

/** Placeholder image tile with diagonal hatch + centered label. */
export function HatchTile({
  label,
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cx("grid place-items-center overflow-hidden rounded-[8px] border border-line", className)}
      style={{
        backgroundImage:
          "repeating-linear-gradient(135deg, #e9e6dd 0 10px, #f1eee7 10px 20px)",
      }}
    >
      {label && (
        <span className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-faint">{label}</span>
      )}
    </div>
  );
}
