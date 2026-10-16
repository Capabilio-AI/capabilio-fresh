import { BADGE_RULES, type PassportSkill } from "@/lib/passport/badges";
import type { UnlockTarget } from "./next-move";

/** The skill to work on next: the one already started and closest, else one only the assessment has seen, else one nobody has touched. */
export function pickTarget(skills: readonly PassportSkill[], areaFor: (skillId: string) => string | null): UnlockTarget | null {
  const open = skills.filter((s) => !s.badge);
  const best = [...open.filter((s) => s.status === "practising")].sort((a, b) => (b.practiceLevel ?? 0) - (a.practiceLevel ?? 0))[0] ?? open.find((s) => s.status === "baseline") ?? open[0];
  if (!best) return null;
  const goal = best.next ? BADGE_RULES[best.next.level].from : 100;
  return { skillId: best.skillId, name: best.name, progress: Math.min(1, (best.practiceLevel ?? 0) / goal), areaKey: areaFor(best.skillId) };
}
