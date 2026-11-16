import { LEVEL_LABEL, type SkillLevel } from "@/lib/professional/skills";
import { clip, polygonPoints, spokePoint, type Spoke } from "@/lib/professional/radar";

const SIZE = 360;
const C = SIZE / 2;
const R = 112;
const RINGS: { f: number; label: string }[] = [{ f: 0.25, label: "" }, { f: 0.5, label: "" }, { f: 0.75, label: "" }, { f: 1, label: "" }];

/** A radar of the strongest skills. The further a point is from the centre, the better you know the skill and the longer you have used it. */
export function RadarChart({ spokes }: { spokes: Spoke[] }) {
  const n = spokes.length;
  const summary = spokes.map((s) => `${s.name}, ${LEVEL_LABEL[s.level as SkillLevel].toLowerCase()}`).join("; ");
  const shape = spokes.map((s, i) => spokePoint(i, n, s.value, C, C, R));
  return (
    <figure>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={`Skill radar. ${summary}.`} className="mx-auto w-full max-w-[420px]">
        {RINGS.map((r) => <polygon key={r.f} points={polygonPoints(spokes.map((_, i) => spokePoint(i, n, r.f, C, C, R)))} fill="none" stroke="var(--m-rule)" strokeWidth={1} />)}
        {spokes.map((s, i) => { const e = spokePoint(i, n, 1, C, C, R); return <line key={s.id} x1={C} y1={C} x2={e.x} y2={e.y} stroke="var(--m-rule)" strokeWidth={1} />; })}
        <polygon points={polygonPoints(shape)} fill="var(--m-accent)" fillOpacity={0.22} stroke="var(--m-accent)" strokeWidth={2.5} strokeLinejoin="round" />
        {shape.map((p, i) => <circle key={spokes[i].id} cx={p.x} cy={p.y} r={4.5} fill="var(--m-accent)" stroke="#fff" strokeWidth={2} />)}
        {spokes.map((s, i) => {
          const p = spokePoint(i, n, 1.2, C, C, R);
          const anchor = p.x < C - 8 ? "end" : p.x > C + 8 ? "start" : "middle";
          return <text key={s.id} x={p.x} y={p.y} textAnchor={anchor} dominantBaseline="middle" fontSize={12.5} fontWeight={700} fill="var(--m-ink)">{clip(s.name)}</text>;
        })}
      </svg>
      <figcaption className="sr-only">{summary}</figcaption>
    </figure>
  );
}
