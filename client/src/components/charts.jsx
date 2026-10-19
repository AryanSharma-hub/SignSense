import { useRef, useState } from 'react';

/*
 * Small single-series charts. Marks use the validated --chart-1 token; text stays in text
 * colours; gridlines are hairlines; every mark has a hover/focus tooltip, and every chart
 * on a page is paired with a table that holds the same numbers.
 */

const W = 640, H = 220, PAD = { l: 40, r: 16, t: 14, b: 28 };

function Tooltip({ tip }) {
  if (!tip) return null;
  return (
    <div role="status" className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[12.5px] shadow-lift"
      style={{ left: `${(tip.x / W) * 100}%`, top: `${(tip.y / H) * 100}%`, marginTop: -10 }}>
      <p className="font-semibold text-ink">{tip.value}</p>
      <p className="text-muted">{tip.label}</p>
    </div>
  );
}

/** Score (0-1) per item over time: a 2px line with ringed markers, y fixed to 0-100%. */
export function ScoreLine({ points, title }) {
  const [tip, setTip] = useState(null);
  if (points.length === 0) return null;
  const x = (i) => PAD.l + (points.length === 1 ? (W - PAD.l - PAD.r) / 2 : (i * (W - PAD.l - PAD.r)) / (points.length - 1));
  const y = (v) => PAD.t + (1 - v) * (H - PAD.t - PAD.b);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i)} ${y(p.value)}`).join(' ');
  const show = (p, i) => setTip({ x: x(i), y: y(p.value), value: `${Math.round(p.value * 100)}%`, label: p.label });
  return (
    <figure className="relative" onPointerLeave={() => setTip(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={title}>
        {[0, 0.5, 0.8, 1].map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="rgb(var(--line))" strokeWidth="1" />
            <text x={PAD.l - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="rgb(var(--muted))">{Math.round(v * 100)}%</text>
          </g>
        ))}
        <path d={`${d} L${x(points.length - 1)} ${y(0)} L${x(0)} ${y(0)} Z`} fill="rgb(var(--chart-1) / 0.10)" />
        <path d={d} fill="none" stroke="rgb(var(--chart-1))" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(p.value)} r="5" fill="rgb(var(--chart-1))" stroke="rgb(var(--surface))" strokeWidth="2" />
            <circle cx={x(i)} cy={y(p.value)} r="14" fill="transparent" tabIndex={0} aria-label={`${p.label}: ${Math.round(p.value * 100)}%`}
              onPointerEnter={() => show(p, i)} onFocus={() => show(p, i)} onBlur={() => setTip(null)} />
          </g>
        ))}
        <text x={x(points.length - 1)} y={y(points.at(-1).value) - 12} textAnchor="end" fontSize="12" fontWeight="700" fill="rgb(var(--ink))">
          {Math.round(points.at(-1).value * 100)}%
        </text>
        <text x={PAD.l} y={H - 8} fontSize="11" fill="rgb(var(--muted))">{points[0].axis}</text>
        {points.length > 1 && <text x={W - PAD.r} y={H - 8} textAnchor="end" fontSize="11" fill="rgb(var(--muted))">{points.at(-1).axis}</text>}
      </svg>
      <Tooltip tip={tip} />
    </figure>
  );
}

/** Counts per day as columns (<= 24px, rounded top, square base). */
export function DailyColumns({ days, title, unit = '' }) {
  const [tip, setTip] = useState(null);
  const ref = useRef(null);
  if (days.length === 0) return null;
  const max = Math.max(1, ...days.map((d) => d.value));
  const nice = max <= 5 ? 5 : Math.ceil(max / 5) * 5;
  const slot = (W - PAD.l - PAD.r) / days.length;
  const bw = Math.min(24, slot - 2);
  const y = (v) => PAD.t + (1 - v / nice) * (H - PAD.t - PAD.b);
  const base = y(0);
  return (
    <figure ref={ref} className="relative" onPointerLeave={() => setTip(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={title}>
        {[0, nice / 2, nice].map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="rgb(var(--line))" strokeWidth="1" />
            <text x={PAD.l - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="rgb(var(--muted))">{v}</text>
          </g>
        ))}
        {days.map((d, i) => {
          const cx = PAD.l + slot * i + slot / 2, top = y(d.value), h = base - top;
          const r = Math.min(4, h / 2, bw / 2);
          const path = h > 0 ? `M${cx - bw / 2} ${base} V${top + r} Q${cx - bw / 2} ${top} ${cx - bw / 2 + r} ${top} H${cx + bw / 2 - r} Q${cx + bw / 2} ${top} ${cx + bw / 2} ${top + r} V${base} Z` : null;
          const show = () => setTip({ x: cx, y: top, value: `${d.value}${unit}`, label: d.label });
          return (
            <g key={d.label}>
              {path && <path d={path} fill="rgb(var(--chart-1))" />}
              <rect x={cx - slot / 2} y={PAD.t} width={slot} height={base - PAD.t} fill="transparent" tabIndex={0}
                aria-label={`${d.label}: ${d.value}${unit}`} onPointerEnter={show} onFocus={show} onBlur={() => setTip(null)} />
            </g>
          );
        })}
        <text x={PAD.l} y={H - 8} fontSize="11" fill="rgb(var(--muted))">{days[0].label}</text>
        <text x={W - PAD.r} y={H - 8} textAnchor="end" fontSize="11" fill="rgb(var(--muted))">{days.at(-1).label}</text>
      </svg>
      <Tooltip tip={tip} />
    </figure>
  );
}
