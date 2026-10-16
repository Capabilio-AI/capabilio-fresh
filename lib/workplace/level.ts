import type { CareerStage } from "@/lib/stage/stage";

/** How much work experience the user has. It decides which tickets they are given, alongside their skill rating. */
export const LEVELS = ["fresher", "junior", "mid", "senior", "expert"] as const;
export type ExperienceLevel = (typeof LEVELS)[number];

const DAY_MS = 86_400_000;

export function yearsSince(isoDate: string, now: Date): number | null {
  const t = Date.parse(isoDate);
  return Number.isNaN(t) ? null : (now.getTime() - t) / (365.25 * DAY_MS);
}

export function levelAtLeast(level: ExperienceLevel, minimum: ExperienceLevel): boolean {
  return LEVELS.indexOf(level) >= LEVELS.indexOf(minimum);
}

/** Students and recent graduates are freshers; professionals are graded by years since their earliest recorded job (under 1, 1-3, 3-6, 6-10, 10+). */
export function experienceLevel({ stage, startDates, now = new Date() }: { stage: CareerStage; startDates: readonly (string | null)[]; now?: Date }): ExperienceLevel {
  if (stage !== "professional") return "fresher";
  const years = startDates.flatMap((d) => (d ? [yearsSince(d, now)] : [])).filter((y): y is number => y !== null);
  if (years.length === 0) return "junior";
  const longest = Math.max(...years);
  if (longest < 1) return "fresher";
  if (longest < 3) return "junior";
  if (longest < 6) return "mid";
  if (longest < 10) return "senior";
  return "expert";
}
