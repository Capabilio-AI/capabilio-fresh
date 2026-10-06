/** Subject priority — PURE. Which of the student's university subjects serve their target career most, and why (facts only). */
import { MAPPING_STRENGTH, REQUIREMENT_WEIGHT } from "@/lib/careers/relevance";
import type { CourseInput, EngineInput, GapRow, Schedule, SubjectRow, Tier } from "./types";

/** Shown with every priority list, verbatim. A priority is never an instruction to skip a required subject. */
export const MANDATORY_NOTE = "All university subjects remain part of your academic curriculum. These are prioritized because they contribute more directly to your target career.";

/** score/maxScore thresholds for the tiers (product defaults). */
export const TIER_THRESHOLDS = { critical: 0.75, high: 0.5, moderate: 0.25 } as const;

const semesterIndex = (year: number, semester: number) => (year - 1) * 2 + (semester - 1);

export function scheduleOf(course: { year: number; semester: number | null }, position: EngineInput["position"]): Schedule {
  if (course.semester === null) {
    if (course.year < position.year) return "PAST";
    if (course.year === position.year) return "CURRENT";
    return course.year <= position.year + 1 ? "UPCOMING" : "FUTURE";
  }
  const delta = semesterIndex(course.year, course.semester) - semesterIndex(position.year, position.semester);
  if (delta < 0) return "PAST";
  if (delta === 0) return "CURRENT";
  return course.year <= position.year + 1 ? "UPCOMING" : "FUTURE";
}

const tierOf = (ratio: number): Tier => (ratio >= TIER_THRESHOLDS.critical ? "CRITICAL" : ratio >= TIER_THRESHOLDS.high ? "HIGH" : ratio >= TIER_THRESHOLDS.moderate ? "MODERATE" : "USEFUL");

export function prioritiseSubjects(courses: CourseInput[], gaps: GapRow[], position: EngineInput["position"]): SubjectRow[] {
  const open = new Map(gaps.filter((g) => !g.met).map((g) => [g.skillId, g]));
  const scored = courses.flatMap((c) => {
    const parts = c.skills.flatMap((s) => {
      const g = open.get(s.skillId);
      return g ? [{ s, g, contribution: REQUIREMENT_WEIGHT[g.importance] * (g.gap / 100) * MAPPING_STRENGTH[s.importance ?? "SUPPORTING"] }] : [];
    });
    const score = parts.reduce((n, p) => n + p.contribution, 0);
    if (score <= 0) return [];
    parts.sort((a, b) => b.contribution - a.contribution || a.g.skillName.localeCompare(b.g.skillName));
    return [{ c, score, parts }];
  });
  const max = Math.max(0, ...scored.map((x) => x.score));
  return scored
    .map(({ c, score, parts }): SubjectRow => {
      const ratio = max > 0 ? score / max : 0;
      return {
        courseId: c.id, title: c.title, year: c.year, semester: c.semester, score, tier: tierOf(ratio), stars: Math.min(5, Math.max(1, Math.ceil(ratio * 5))), schedule: scheduleOf(c, position),
        facts: { skillIds: parts.map((p) => p.g.skillId), skillNames: parts.map((p) => p.g.skillName), outcomeCount: parts.reduce((n, p) => n + p.s.outcomeCount, 0), gapPoints: parts.reduce((n, p) => n + p.g.gap, 0) },
      };
    })
    .sort((a, b) => b.score - a.score || a.year - b.year || a.title.localeCompare(b.title));
}
