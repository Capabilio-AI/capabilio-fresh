export interface RadarAxis {
  label: string;
  /** 0-100; null means not assessed and is drawn at the centre */
  value: number | null;
  /** 0-100 target ring point, drawn as a dashed curve */
  target?: number;
}

const W = 600;
const H = 480;
const CX = W / 2;
const CY = H / 2;
const R = 150;
const RINGS = [25, 50, 75, 100];
const MAX_LINE = 15;

const polar = (i: number, n: number, pct: number): [number, number] => {
  const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
  const r = (Math.max(0, Math.min(100, pct)) / 100) * R;
  return [CX + Math.cos(a) * r, CY + Math.sin(a) * r];
};

/** Closed Catmull-Rom spline, so the shape is a smooth round blob instead of a polygon. */
function smooth(pts: [number, number][]): string {
  const n = pts.length;
  if (n < 3) return "";
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return `${d}Z`;
}

function lines(label: string): string[] {
  if (label.length <= MAX_LINE) return [label];
  const words = label.split(" ");
  const out: string[] = [""];
  for (const w of words) {
    const cur = out[out.length - 1];
    if ((cur + " " + w).trim().length <= MAX_LINE || cur === "") out[out.length - 1] = (cur + " " + w).trim();
    else out.push(w);
  }
  const two = out.slice(0, 2);
  if (out.length > 2) two[1] = `${two[1].slice(0, MAX_LINE - 1)}…`;
  return two.map((l) => (l.length > MAX_LINE ? `${l.slice(0, MAX_LINE - 1)}…` : l));
}

/** A round radar: concentric circles, spokes, and a smooth filled curve. Values are percentages. */
export function RoundRadar({ axes, color = "var(--m-ink)", targetColor = "var(--m-off)", caption }: { axes: RadarAxis[]; color?: string; targetColor?: string; caption: string }) {
  const n = axes.length;
  if (n < 3) return null;
  const pts = axes.map((a, i) => polar(i, n, a.value ?? 0));
  const tpts = axes.every((a) => a.target !== undefined) ? axes.map((a, i) => polar(i, n, a.target ?? 0)) : null;
  const summary = axes.map((a) => `${a.label} ${a.value === null ? "not assessed" : `${a.value} percent`}`).join(", ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${caption}: ${summary}`} className="mx-auto h-auto w-full max-w-[640px]">
      <defs>
        <radialGradient id="rr-fill" cx="50%" cy="50%" r="50%">
          <stop offset="0%" style={{ stopColor: color }} stopOpacity="0.38" />
          <stop offset="100%" style={{ stopColor: color }} stopOpacity="0.12" />
        </radialGradient>
      </defs>
      {RINGS.map((r) => <circle key={r} cx={CX} cy={CY} r={(r / 100) * R} fill="none" className="stroke-[var(--m-rule)]" strokeWidth={r === 100 ? 1.5 : 1} />)}
      {RINGS.slice(0, 3).map((r) => <text key={r} x={CX + 4} y={CY - (r / 100) * R + 12} fontSize="10" className="fill-[var(--m-muted)]">{r}%</text>)}
      {axes.map((_, i) => { const [x, y] = polar(i, n, 100); return <line key={i} x1={CX} y1={CY} x2={x} y2={y} className="stroke-[var(--m-rule)]" strokeWidth="1" />; })}
      {tpts && <path d={smooth(tpts)} fill="none" style={{ stroke: targetColor }} strokeWidth="2" strokeDasharray="5 5" />}
      <path d={smooth(pts)} fill="url(#rr-fill)" style={{ stroke: color }} strokeWidth="3" strokeLinejoin="round" />
      {pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="4.5" fill="#fff" style={{ stroke: color }} strokeWidth="2.5" />)}
      {axes.map((a, i) => {
        const [lx, ly] = polar(i, n, 100 + 18);
        const cos = Math.cos(-Math.PI / 2 + (i / n) * Math.PI * 2);
        const anchor = Math.abs(cos) < 0.25 ? "middle" : cos > 0 ? "start" : "end";
        const ls = lines(a.label);
        const y0 = ly - ((ls.length - 1) * 7) / 2;
        return (
          <text key={i} x={lx} y={y0} textAnchor={anchor} fontSize="12.5" fontWeight="700" className="fill-[var(--m-ink)]">
            {ls.map((l, k) => <tspan key={k} x={lx} dy={k === 0 ? 4 : 14}>{l}</tspan>)}
            <tspan x={lx} dy={14} fontSize="12" fontWeight="400" className="fill-[var(--m-muted)]">{a.value === null ? "Not assessed" : `${a.value}%`}</tspan>
          </text>
        );
      })}
    </svg>
  );
}
