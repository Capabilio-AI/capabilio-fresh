/**
 * What a curriculum's course count is made of. A syllabus lists far more entries than a student sits: every elective option,
 * lab, audit and project line counts as a "course", but a student takes only a few electives. Showing the split lets a college
 * see (and trim) what actually applies.
 */
export type CourseGroup = "core" | "lab" | "elective" | "other";
export const COURSE_GROUPS: readonly CourseGroup[] = ["core", "lab", "elective", "other"];
export const GROUP_LABEL: Record<CourseGroup, string> = { core: "Core theory", lab: "Labs", elective: "Elective options", other: "Projects & audit" };

type Classifiable = { kind: string; category: string | null };

export function courseGroup(c: Classifiable): CourseGroup {
  if (c.kind === "lab") return "lab";
  if (c.kind === "elective_option" || /elective/i.test(c.category ?? "")) return "elective";
  if (c.kind === "project" || c.kind === "audit") return "other";
  return "core";
}

export type Composition = Record<CourseGroup, number>;

export function composition(courses: readonly Classifiable[]): Composition {
  const out: Composition = { core: 0, lab: 0, elective: 0, other: 0 };
  for (const c of courses) out[courseGroup(c)]++;
  return out;
}

export interface YearCoverage {
  year: number;
  courses: number;
}

/** Courses per year of study for years 1–`years`, so a missing year is visible at a glance. Years beyond `years` are still reported. */
export function yearCoverage(courses: readonly { year: number }[], years = 4): YearCoverage[] {
  const counts = new Map<number, number>();
  for (const c of courses) counts.set(c.year, (counts.get(c.year) ?? 0) + 1);
  const all = new Set([...Array.from({ length: years }, (_, i) => i + 1), ...counts.keys()]);
  return [...all].sort((a, b) => a - b).map((year) => ({ year, courses: counts.get(year) ?? 0 }));
}
