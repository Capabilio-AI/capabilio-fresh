import type { ModuleTopic } from "@/lib/skillstudio/modules";

const MAX = 14;
const W = 240;
const H = 56;

/**
 * A course drawn as the route its lessons make: one station each, filled when evidence proved it, half when the student is learning it,
 * dashed when it is not measured yet. The picture is the course's real state, not decoration.
 */
export function RouteGlyph({ topics, className }: { topics: readonly ModuleTopic[]; className?: string }) {
  const shown = topics.slice(0, MAX);
  const n = shown.length;
  const pts = shown.map((_, i) => ({ x: n === 1 ? W / 2 : 14 + (i * (W - 28)) / (n - 1), y: i % 2 === 0 ? 18 : 38 }));
  const label = `${topics.filter((t) => t.status === "TARGET_MET").length} of ${topics.length} lessons proven`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className={className} preserveAspectRatio="xMidYMid meet">
      <polyline points={pts.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" className="ss-route-line" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {shown.map((t, i) => {
        const { x, y } = pts[i];
        const proven = t.status === "TARGET_MET";
        const learning = t.userState === "LEARNING" || t.status === "LEARNING";
        return (
          <g key={t.key}>
            <circle cx={x} cy={y} r="7" fill={proven ? "#fff" : "rgb(0 0 0 / 0.18)"} stroke="#fff" strokeWidth="2.5" strokeDasharray={t.level === null && !learning ? "3 2.6" : undefined} />
            {learning && !proven && <path d={`M${x} ${y - 4.6}a4.6 4.6 0 0 0 0 9.2z`} fill="#fff" />}
          </g>
        );
      })}
      {topics.length > MAX && <text x={W - 2} y={H - 2} textAnchor="end" fontSize="10" fontWeight="700" fill="#fff">+{topics.length - MAX}</text>}
    </svg>
  );
}
