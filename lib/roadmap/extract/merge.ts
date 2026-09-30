import type { CourseSection } from "./chunk";
import type { CandidateRow } from "./types";

const STOP = new Set(["and", "the", "of", "to", "through", "using", "in", "for", "with", "a", "an"]);
const words = (s: string) =>
  s
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((w) => w && !STOP.has(w))
    .map((w) => ROMAN_DIGIT[w] ?? w);
const ROMAN_DIGIT: Record<string, string> = { i: "1", ii: "2", iii: "3", iv: "4" };
const isLab = (s: string) => /\blab(oratory)?\b/i.test(s);
const core = (s: string) => words(s).filter((w) => w !== "lab" && w !== "laboratory");

/** Pure. Same semester, same lab-ness, and the title words match (equal, or one is a strict subset of the other with ≥2 words). */
export function sameCourse(tableName: string, sectionTitle: string): boolean {
  // a table cell can carry an alternative after a slash ("Soft skills / SWAYAM Plus - …"): the first segment is the course
  tableName = tableName.split(/\s*\/\s*/)[0] || tableName;
  if (isLab(tableName) !== isLab(sectionTitle)) return false;
  const a = core(tableName);
  const b = core(sectionTitle);
  if (a.length === 0 || b.length === 0) return false;
  const sa = new Set(a);
  const sb = new Set(b);
  const inter = [...sa].filter((w) => sb.has(w)).length;
  if (inter === sa.size && inter === sb.size) return true;
  const small = Math.min(sa.size, sb.size);
  return small >= 2 && inter === small && inter / Math.max(sa.size, sb.size) >= 0.6;
}

export function findSection(row: Pick<CandidateRow, "year" | "semester" | "name">, sections: CourseSection[]): CourseSection | undefined {
  return sections.find((s) => s.year === row.year && s.semester === row.semester && sameCourse(row.name, s.title));
}

export type BaseRow = Omit<CandidateRow, "tempId" | "outcomesCount" | "suggestedAreaKeys" | "mappingNote">;

/** Pure. Table rows are authoritative; course sections with no table row are added, flagged for review. */
export function mergeRows(tableRows: BaseRow[], sections: CourseSection[]): { rows: BaseRow[]; sectionFor: Map<BaseRow, CourseSection | undefined> } {
  const rows = [...tableRows];
  const sectionFor = new Map<BaseRow, CourseSection | undefined>();
  const used = new Set<CourseSection>();
  for (const r of rows) {
    const s = findSection(r, sections);
    if (s) used.add(s);
    sectionFor.set(r, s);
  }
  for (const s of sections) {
    if (used.has(s)) continue;
    const orphan: BaseRow = {
      year: s.year,
      semester: s.semester,
      name: s.title.replace(/\s*\(([^)]*elective[^)]*|skill enhancement course)\)\s*$/i, "").replace(/\s+/g, " ").trim().slice(0, 200),
      code: null,
      category: null,
      kind: isLab(s.title) ? "lab" : "course",
      confidence: "low",
      needsReview: true,
      reason: "Found in the course details but not in the semester table — check it belongs to this semester.",
    };
    rows.push(orphan);
    sectionFor.set(orphan, s);
  }
  return { rows, sectionFor };
}
