import type { PlanBKind } from "@/lib/careers/plan-b-rules";

const STATIONS: { kind: Exclude<PlanBKind, "undecided">; label: string; y: number }[] = [
  { kind: "same_role", label: "Same role", y: 16 },
  { kind: "change_role", label: "New role", y: 44 },
  { kind: "higher_studies", label: "Higher studies", y: 72 },
  { kind: "entrepreneur", label: "Startup", y: 100 },
];
const FORK_X = 190;
const END_X = 410;
const ON = "var(--app-orange)";
const OFF = "var(--app-border)";

/** A metro-line sketch of the choice: you, now, fork into the four routes. The picked route lights up; "not yet" keeps the fork pulsing. */
export function PlanBRouteMap({ kind }: { kind: PlanBKind | null }) {
  const undecided = kind === "undecided";
  return (
    <svg viewBox="0 0 560 116" aria-hidden="true" className="h-auto w-full overflow-visible">
      <line x1={28} y1={58} x2={FORK_X} y2={58} className="pb-line" stroke={kind ? ON : OFF} strokeWidth={4} strokeLinecap="round" />
      {STATIONS.map((s) => {
        const picked = s.kind === kind;
        return (
          <g key={s.kind}>
            <path d={`M${FORK_X} 58 C ${FORK_X + 70} 58, ${END_X - 90} ${s.y}, ${END_X} ${s.y}`} fill="none" className="pb-line" stroke={picked ? ON : OFF} strokeWidth={picked ? 4 : 2.5} strokeLinecap="round" strokeDasharray={undecided ? "2 7" : undefined} />
            {picked && <circle cx={END_X} cy={s.y} r={9} className="pb-ring" fill={ON} />}
            <circle cx={END_X} cy={s.y} r={picked ? 9 : 6} className="pb-dot" fill={picked ? ON : "var(--app-card)"} stroke={picked ? ON : OFF} strokeWidth={2.5} />
            <text x={END_X + 20} y={s.y + 4} fontSize={12} fontWeight={picked ? 700 : 500} fill={picked ? "var(--app-charcoal)" : "var(--app-muted)"}>{s.label}</text>
          </g>
        );
      })}
      {undecided && <circle cx={FORK_X} cy={58} r={9} className="pb-ring" fill={ON} />}
      <circle cx={28} cy={58} r={7} fill="var(--app-charcoal)" />
      <circle cx={FORK_X} cy={58} r={7} className="pb-dot" fill="var(--app-card)" stroke={kind ? ON : "var(--app-charcoal)"} strokeWidth={3} />
      <text x={28} y={84} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--app-muted)">Now</text>
      <text x={FORK_X} y={84} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--app-muted)">3rd year</text>
    </svg>
  );
}
