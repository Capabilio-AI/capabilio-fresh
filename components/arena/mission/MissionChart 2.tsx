import type { Series } from "@/lib/arena-challenges/missions/types";

const W = 560;
const H = 250;
const PAD = { l: 52, r: 14, t: 14, b: 40 };
const STYLE: Record<string, { cls: string; dash?: string; width: number }> = {
  main: { cls: "text-app-orange", width: 2.5 },
  ref: { cls: "text-app-muted", dash: "5 4", width: 1.5 },
  limit: { cls: "text-app-rose", dash: "2 4", width: 1.75 },
};

function ticks(min: number, max: number, count = 4): number[] {
  const span = max - min || 1;
  return Array.from({ length: count + 1 }, (_, i) => min + (span * i) / count);
}
const label = (v: number) => (Math.abs(v) >= 1000 ? v.toExponential(1) : Number(v.toFixed(Math.abs(v) < 10 ? 2 : 1)).toString());

/** A plain SVG line chart: no chart library, readable in light and dark, with an accessible summary. */
export function MissionChart({ series }: { series: Series }) {
  const pts = series.lines.flatMap((l) => l.pts);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  let yMin = Math.min(...ys);
  let yMax = Math.max(...ys);
  const pad = (yMax - yMin || 1) * 0.08;
  yMin -= pad;
  yMax += pad;
  const x = (v: number) => PAD.l + ((v - xMin) / (xMax - xMin || 1)) * (W - PAD.l - PAD.r);
  const y = (v: number) => H - PAD.b - ((v - yMin) / (yMax - yMin || 1)) * (H - PAD.t - PAD.b);
  return (
    <figure className="rounded-lg border border-[var(--m-rule)] bg-white p-3">
      <figcaption className="px-1 pb-1 font-lp-body text-[12.5px] font-semibold text-[var(--m-ink)]">{series.title}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${series.title}: ${series.lines.map((l) => l.name).join(", ")}`} className="h-auto w-full">
        {ticks(yMin, yMax).map((t) => (
          <g key={`y${t}`}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="currentColor" className="text-[var(--m-rule)]" strokeWidth={1} />
            <text x={PAD.l - 6} y={y(t) + 4} textAnchor="end" className="fill-current text-app-muted" fontSize={11}>{label(t)}</text>
          </g>
        ))}
        {ticks(xMin, xMax).map((t) => (
          <text key={`x${t}`} x={x(t)} y={H - PAD.b + 16} textAnchor="middle" className="fill-current text-app-muted" fontSize={11}>{label(t)}</text>
        ))}
        <text x={(PAD.l + W - PAD.r) / 2} y={H - 6} textAnchor="middle" className="fill-current text-app-muted" fontSize={11}>{series.xLabel}</text>
        <text transform={`rotate(-90 12 ${H / 2})`} x={12} y={H / 2} textAnchor="middle" className="fill-current text-app-muted" fontSize={11}>{series.yLabel}</text>
        {series.lines.map((l) => {
          const s = STYLE[l.style ?? "main"];
          return <polyline key={l.name} points={l.pts.map(([px, py]) => `${x(px).toFixed(1)},${y(py).toFixed(1)}`).join(" ")} fill="none" stroke="currentColor" className={s.cls} strokeWidth={s.width} strokeDasharray={s.dash} strokeLinejoin="round" />;
        })}
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1 px-1 pt-1">
        {series.lines.map((l) => (
          <span key={l.name} className={`flex items-center gap-1.5 font-lp-body text-[11.5px] text-app-muted`}>
            <svg width="18" height="6" aria-hidden><line x1="0" x2="18" y1="3" y2="3" stroke="currentColor" className={STYLE[l.style ?? "main"].cls} strokeWidth="2.5" strokeDasharray={STYLE[l.style ?? "main"].dash} /></svg>
            {l.name}
          </span>
        ))}
      </div>
    </figure>
  );
}
