import { timingOf, type CurriculumCourse, type Position, type Timing } from "./coverage";

export type SubjectStatus = "PROVEN" | "IN_PROGRESS" | "NOT_PROVEN" | "NOT_MAPPED";

export interface SubjectTopic {
  nodeKey: string;
  title: string;
  /** null = not assessed */
  level: number | null;
  target: number;
  met: boolean;
}

/** One college subject on the syllabus map. Its status comes only from evidence on the career topics it teaches; a student cannot mark it. */
export interface SubjectNode {
  courseId: string;
  title: string;
  code: string | null;
  year: number;
  semester: number | null;
  timing: Timing;
  units: { no: number; title: string }[];
  topics: SubjectTopic[];
  provenCount: number;
  status: SubjectStatus;
}

export interface MapTopic {
  key: string;
  title: string;
  skillId: string;
  target: number;
  level: number | null;
}

/**
 * Pure. Every subject of the student's published syllabus in teaching order, with the career topics it teaches and how far the student's
 * evidence (Arena passes, projects, ...) has taken those topics. PROVEN needs every topic it teaches at target; a subject that teaches none of this
 * career's topics is NOT_MAPPED (it is still part of the degree, just not tracked here).
 */
export function buildSyllabus(courses: CurriculumCourse[], topics: readonly MapTopic[], pos: Position, inferredThreshold: number): SubjectNode[] {
  return courses
    .map((c): SubjectNode => {
      const taught = new Set(c.links.filter((l) => l.tier === "OFFICIAL" || (l.confidence !== null && l.confidence >= inferredThreshold)).map((l) => l.skillId));
      const mine = topics
        .filter((t) => taught.has(t.skillId))
        .map((t): SubjectTopic => ({ nodeKey: t.key, title: t.title, level: t.level, target: t.target, met: t.level !== null && t.level >= t.target }));
      const proven = mine.filter((t) => t.met).length;
      const status: SubjectStatus = mine.length === 0 ? "NOT_MAPPED" : proven === mine.length ? "PROVEN" : proven > 0 || mine.some((t) => (t.level ?? 0) > 0) ? "IN_PROGRESS" : "NOT_PROVEN";
      return {
        courseId: c.id, title: c.title, code: c.code, year: c.year, semester: c.semester, timing: timingOf(c, pos),
        units: c.units.map((u) => ({ no: u.no, title: u.title })), topics: mine, provenCount: proven, status,
      };
    })
    .sort((a, b) => a.year - b.year || (a.semester ?? 0) - (b.semester ?? 0) || a.title.localeCompare(b.title));
}
