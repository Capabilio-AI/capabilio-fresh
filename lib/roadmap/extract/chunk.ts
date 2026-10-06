/**
 * Pure. Splits syllabus text into (a) one chunk per semester course-structure table and (b) one section per course.
 * Boundaries were confirmed against the real JNTUK R23 CSE PDF (docs/curriculum-pdf-extraction-audit.md): tables begin
 * "B.Tech.– II Year I Semester"; course sections begin "II Year I Semester" (title on the same or following lines).
 */
import { parseCourseSection, type ParsedSection } from "./section";

const ROMAN: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6 };
const YS = "(I{1,3}|IV|VI?)\\s+Year\\s*[–—-]?\\s*(I{1,2})\\s+Semester";
const TABLE_HEADING = new RegExp(`^B\\.?\\s*Tech\\.?\\s*[–—-]?\\s*${YS}\\s*$`, "i");
const COURSE_HEADING = new RegExp(`^${YS}\\b\\s*(.*)$`, "i");
const TITLE_STOP = /^(L\s+T\s+P\s+C\b|\d+\s+\d+\s+\d+\s+\d|Pre-?requisites?|Course Objectives?|Course Outcomes?|Common to\b|\(Common to)/i;
const MAX_SECTION_CHARS = 12_000;

export interface SemesterChunk {
  year: number;
  semester: number;
  text: string;
}
export interface CourseSection {
  year: number;
  semester: number;
  title: string;
  /** Course Outcome texts (kept for the legacy review UI); the full structure is in `parsed`. */
  outcomes: string[];
  /** raw section text (capped) — the source every extracted field is grounded against */
  text: string;
  parsed: ParsedSection;
}

const parseYs = (y: string, s: string) => ({ year: ROMAN[y.toUpperCase()] ?? 0, semester: ROMAN[s.toUpperCase()] ?? 0 });

type Boundary = { line: number; kind: "table" | "course"; year: number; semester: number; rest: string };

function boundaries(lines: string[]): Boundary[] {
  const out: Boundary[] = [];
  lines.forEach((raw, line) => {
    const t = raw.trim();
    const table = TABLE_HEADING.exec(t);
    if (table) return void out.push({ line, kind: "table", ...parseYs(table[1], table[2]), rest: "" });
    const course = COURSE_HEADING.exec(t);
    if (course && !/^B\.?\s*Tech/i.test(t)) out.push({ line, kind: "course", ...parseYs(course[1], course[2]), rest: (course[3] ?? "").trim() });
  });
  return out.filter((b) => b.year >= 1 && b.semester >= 1 && b.semester <= 2);
}

function titleOf(lines: string[], from: number, first: string, to: number): string {
  const parts: string[] = [];
  const push = (l: string) => {
    const cleaned = l.replace(/\s+L\s+T\s+P\s+C\b.*$/i, "").trim();
    if (cleaned) parts.push(cleaned);
    return cleaned.length !== l.trim().length; // a trailing "L T P C" on the line ends the title
  };
  if (first && push(first)) return parts.join(" ");
  for (let i = from + 1; i < to && parts.length < 4; i++) {
    const t = lines[i].trim();
    if (!t) continue;
    if (TITLE_STOP.test(t)) break;
    if (push(t)) break;
  }
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

const TABLE_END_INCLUSIVE = /^Total\b/i;
const TABLE_END_EXCLUSIVE = /^(Note\s*:|Open Electives?,|Minor (Engineering|in)\b|COURSES OFFERED|Mandatory\b|(MC|HC)\s)/i;

/** Pure. The regular semester ends at its "Total" row (or a "Note:"); Minor/Honors/Open-elective pools listed after it are not that semester's courses. */
export function trimTable(text: string): string {
  const lines = text.split("\n");
  const out: string[] = [];
  for (const [i, l] of lines.entries()) {
    const t = l.trim();
    if (i > 0 && TABLE_END_EXCLUSIVE.test(t)) break;
    out.push(l);
    if (i > 0 && TABLE_END_INCLUSIVE.test(t)) break;
  }
  return out.join("\n").trim();
}

export function chunkSyllabus(pages: string[]): { tables: SemesterChunk[]; courses: CourseSection[] } {
  const lines = pages.join("\n").split(/\r?\n/);
  const bs = boundaries(lines);
  const tableByKey = new Map<string, SemesterChunk>();
  const courses: CourseSection[] = [];
  bs.forEach((b, i) => {
    const end = bs[i + 1]?.line ?? lines.length;
    if (b.kind === "table") {
      // a heading can repeat (a page-break fragment) — keep one chunk per semester
      const key = `${b.year}-${b.semester}`;
      const text = trimTable(lines.slice(b.line, end).join("\n"));
      const prev = tableByKey.get(key);
      tableByKey.set(key, { year: b.year, semester: b.semester, text: prev ? `${prev.text}\n${text}` : text });
      return;
    }
    const sectionLines = lines.slice(b.line, end);
    const title = titleOf(lines, b.line, b.rest, end);
    if (title.length < 3) return;
    const text = sectionLines.join("\n").slice(0, MAX_SECTION_CHARS);
    const parsed = parseCourseSection(text.split("\n"));
    courses.push({ year: b.year, semester: b.semester, title, outcomes: parsed.outcomes.map((o) => o.text), text, parsed });
  });
  return { tables: [...tableByKey.values()], courses };
}
