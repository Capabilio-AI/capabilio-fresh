/**
 * Curriculum coverage of one skill, from the student's published syllabus. Deterministic, and honest about what it does not know.
 *   STRONG / PARTIAL  the skill is taught by courses we can name
 *   NONE              enough of the syllabus was analysed to say it is NOT taught
 *   UNKNOWN           too little was analysed to say either way (never read as "not taught")
 * Official links are confirmed by a person; inferred links are Capabilio's own reading of the syllabus, shown only above a confidence threshold and
 * always labelled. Inferred coverage is never reported as college-confirmed.
 */
export type Tier = "OFFICIAL" | "INFERRED";
export type CoverageState = "STRONG" | "PARTIAL" | "NONE" | "UNKNOWN";
export type Timing = "COMPLETED" | "CURRENT" | "UPCOMING" | "UNKNOWN";

export interface SkillLink {
  skillId: string;
  tier: Tier;
  /** 0-1; null for older confirmed links that never recorded one */
  confidence: number | null;
  /** how specific the link is */
  level: "COURSE" | "UNIT" | "OUTCOME";
  unitId?: string;
  outcomeId?: string;
  importance?: "CORE" | "SUPPORTING" | "MINOR" | null;
  evidence?: string | null;
}

export interface CurriculumCourse {
  id: string;
  title: string;
  code: string | null;
  year: number;
  semester: number | null;
  pages: { start: number; end: number } | null;
  /** the course has been through skill analysis (even if nothing mapped) */
  analysed: boolean;
  units: { id: string; no: number; title: string }[];
  outcomes: { id: string; code: string; text: string; source: "EXTRACTED" | "INFERRED" | "COLLEGE_CONFIRMED" }[];
  links: SkillLink[];
}

export interface CoverageItem {
  courseId: string;
  title: string;
  code: string | null;
  year: number;
  semester: number | null;
  timing: Timing;
  tier: Tier;
  units: { no: number; title: string }[];
  outcomes: { code: string; text: string; source: "EXTRACTED" | "INFERRED" | "COLLEGE_CONFIRMED" }[];
  pages: { start: number; end: number } | null;
  confidence: number | null;
  evidence: string | null;
}

export interface NodeCoverage {
  state: CoverageState;
  /** which kind of link the coverage rests on; null when there is none */
  basis: Tier | "MIXED" | null;
  items: CoverageItem[];
  /** why the state is UNKNOWN, when it is */
  unknownReason: "NO_CURRICULUM" | "NOT_ENOUGH_ANALYSED" | null;
}

/** NONE is only claimed when at least this share of the syllabus's courses has been analysed. */
export const MIN_ANALYSED_SHARE = 0.6;

export interface Position {
  year: number | null;
  semester: number | null;
}

/** Pure. When the course is taught relative to where the student is (year, and semester if known). */
export function timingOf(course: { year: number; semester: number | null }, pos: Position): Timing {
  if (pos.year === null) return "UNKNOWN";
  if (course.year < pos.year) return "COMPLETED";
  if (course.year > pos.year) return "UPCOMING";
  if (course.semester === null || pos.semester === null) return "CURRENT";
  return course.semester < pos.semester ? "COMPLETED" : course.semester > pos.semester ? "UPCOMING" : "CURRENT";
}

/** Pure. Does the syllabus have enough analysed courses to say a skill is not taught? */
export function dataSufficient(courses: CurriculumCourse[]): boolean {
  return courses.length > 0 && courses.filter((c) => c.analysed).length / courses.length >= MIN_ANALYSED_SHARE;
}

export function classifyCoverage(skillId: string, courses: CurriculumCourse[] | null, pos: Position, inferredThreshold: number): NodeCoverage {
  if (!courses || courses.length === 0) return { state: "UNKNOWN", basis: null, items: [], unknownReason: "NO_CURRICULUM" };

  const items: CoverageItem[] = [];
  let strongSignal = false;
  let specific = 0;
  for (const c of courses) {
    const links = c.links.filter((l) => l.skillId === skillId && (l.tier === "OFFICIAL" || (l.confidence !== null && l.confidence >= inferredThreshold)));
    if (links.length === 0) continue;
    const official = links.some((l) => l.tier === "OFFICIAL");
    const unitIds = new Set(links.flatMap((l) => (l.unitId ? [l.unitId] : [])));
    const outcomeIds = new Set(links.flatMap((l) => (l.outcomeId ? [l.outcomeId] : [])));
    specific += unitIds.size + outcomeIds.size;
    if (links.some((l) => l.importance === "CORE" && l.tier === "OFFICIAL")) strongSignal = true;
    const best = [...links].sort((a, b) => (b.confidence ?? 1) - (a.confidence ?? 1))[0];
    items.push({
      courseId: c.id, title: c.title, code: c.code, year: c.year, semester: c.semester, timing: timingOf(c, pos), tier: official ? "OFFICIAL" : "INFERRED",
      units: c.units.filter((u) => unitIds.has(u.id)).map((u) => ({ no: u.no, title: u.title })),
      outcomes: c.outcomes.filter((o) => outcomeIds.has(o.id)).map((o) => ({ code: o.code, text: o.text, source: o.source })),
      pages: c.pages, confidence: best.confidence, evidence: best.evidence ?? null,
    });
  }
  items.sort((a, b) => a.year - b.year || (a.semester ?? 0) - (b.semester ?? 0) || a.title.localeCompare(b.title));

  if (items.length === 0) {
    return dataSufficient(courses) ? { state: "NONE", basis: null, items: [], unknownReason: null } : { state: "UNKNOWN", basis: null, items: [], unknownReason: "NOT_ENOUGH_ANALYSED" };
  }
  const tiers = new Set(items.map((i) => i.tier));
  const basis = tiers.size === 2 ? "MIXED" : [...tiers][0];
  const strong = strongSignal || items.length >= 2 || specific >= 3;
  return { state: strong ? "STRONG" : "PARTIAL", basis, items, unknownReason: null };
}

export interface SubjectPriority {
  courseId: string;
  title: string;
  year: number;
  semester: number | null;
  timing: Timing;
  /** Σ importance weight × remaining gap share, over the topics this course feeds */
  score: number;
  topics: { nodeKey: string; title: string; gapShare: number }[];
  tier: Tier | "MIXED";
}

/**
 * Pure. Which of the student's subjects matter most for this career right now: each course scores the sum, over the roadmap topics it teaches, of
 * the topic's importance weight × how far the student still is from its target (an unassessed topic counts as fully open). The score only RANKS
 * subjects: every subject remains part of the degree.
 */
export function subjectPriorities(
  courses: CurriculumCourse[],
  topics: { key: string; title: string; skillId: string; importance: "CORE" | "RECOMMENDED" | "OPTIONAL"; target: number; level: number | null }[],
  pos: Position,
  inferredThreshold: number
): SubjectPriority[] {
  const weight = { CORE: 3, RECOMMENDED: 2, OPTIONAL: 1 } as const;
  const bySubject = new Map<string, SubjectPriority>();
  for (const t of topics) {
    const cov = classifyCoverage(t.skillId, courses, pos, inferredThreshold);
    const gapShare = t.level === null ? 1 : Math.max(0, 1 - t.level / Math.max(1, t.target));
    for (const item of cov.items) {
      const cur = bySubject.get(item.courseId) ?? { courseId: item.courseId, title: item.title, year: item.year, semester: item.semester, timing: item.timing, score: 0, topics: [], tier: item.tier };
      cur.score += weight[t.importance] * gapShare;
      cur.topics.push({ nodeKey: t.key, title: t.title, gapShare: Math.round(gapShare * 100) / 100 });
      if (cur.tier !== item.tier) cur.tier = "MIXED";
      bySubject.set(item.courseId, cur);
    }
  }
  return [...bySubject.values()].map((s) => ({ ...s, score: Math.round(s.score * 100) / 100 })).sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}
