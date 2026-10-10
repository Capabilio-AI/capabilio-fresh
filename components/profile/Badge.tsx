import type { BadgeLevel } from "@/lib/passport/badges";

const FILL: Record<BadgeLevel, { bg: string; fg: string; stars: number }> = {
  Foundation: { bg: "var(--m-accent-soft)", fg: "var(--m-accent-ink)", stars: 1 },
  Proficient: { bg: "var(--m-accent)", fg: "#ffffff", stars: 2 },
  Advanced: { bg: "var(--m-ink)", fg: "var(--m-accent)", stars: 3 },
};

/** A hexagon badge: the level is the fill and the number of marks, never colour alone. */
export function BadgeMark({ level, size = 56, onDark = false }: { level: BadgeLevel; size?: number; onDark?: boolean }) {
  const { bg, fg, stars } = FILL[level];
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" aria-hidden className="shrink-0">
      <path d="M28 3 L50 15.5 V40.5 L28 53 L6 40.5 V15.5 Z" fill={bg} stroke={onDark ? "#ffffff" : "var(--m-ink)"} strokeWidth="2" strokeLinejoin="round" />
      {Array.from({ length: stars }, (_, i) => (
        <path key={i} d="M0 -5 L1.4 -1.5 L5 -1.4 L2.2 0.8 L3.2 4.3 L0 2.2 L-3.2 4.3 L-2.2 0.8 L-5 -1.4 L-1.4 -1.5 Z" fill={fg} transform={`translate(${28 + (i - (stars - 1) / 2) * 12} 28)`} />
      ))}
    </svg>
  );
}

export function NotEarnedMark({ size = 56 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" aria-hidden className="shrink-0">
      <path d="M28 3 L50 15.5 V40.5 L28 53 L6 40.5 V15.5 Z" fill="none" stroke="var(--m-off)" strokeWidth="2" strokeDasharray="4 4" strokeLinejoin="round" />
    </svg>
  );
}
