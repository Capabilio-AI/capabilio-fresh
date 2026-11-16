import { monthsFor, type ProSkill, type SkillLevel } from "./skills";
import type { ExperienceRow } from "./experience";

export const LEVEL_VALUE: Record<SkillLevel, number> = { learning: 1 / 3, working: 2 / 3, expert: 1 };

/** How far out a skill sits: half from how well you know it, a quarter as a floor, and up to a quarter more for time spent using it (five years fills it). */
export function reach(level: SkillLevel, months: number): number {
  return Math.round((0.25 + 0.5 * LEVEL_VALUE[level] + 0.25 * Math.min(1, months / 60)) * 1000) / 1000;
}

export interface Spoke { id: string; name: string; level: SkillLevel; value: number }

/** The skills to draw: furthest out first (level plus time used), then A to Z. At most `max`. A radar needs at least three. */
export function radarSkills(skills: readonly ProSkill[], jobs: readonly (ExperienceRow & { id: string })[], now: Date = new Date(), max = 8): Spoke[] {
  return [...skills]
    .map((s) => ({ s, months: monthsFor(s, jobs, now) }))
    .map(({ s, months }) => ({ id: s.id, name: s.name, level: s.level, value: reach(s.level, months) }))
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name))
    .slice(0, max);
}

export interface Pt { x: number; y: number }

/** A point `fraction` of the way out along spoke `i` of `n`. Spoke 0 points straight up and the rest follow clockwise. */
export function spokePoint(i: number, n: number, fraction: number, cx: number, cy: number, r: number): Pt {
  const angle = -Math.PI / 2 + (2 * Math.PI * i) / n;
  return { x: Math.round((cx + Math.cos(angle) * r * fraction) * 100) / 100, y: Math.round((cy + Math.sin(angle) * r * fraction) * 100) / 100 };
}

export const polygonPoints = (pts: readonly Pt[]): string => pts.map((p) => `${p.x},${p.y}`).join(" ");

/** "Apache Kafka and Streaming" cut to fit a label, with an ellipsis. */
export const clip = (s: string, max = 16): string => (s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`);
