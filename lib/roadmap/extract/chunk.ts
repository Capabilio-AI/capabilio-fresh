/**
 * Pure. Splits syllabus text into (a) one chunk per semester course-structure table and (b) one section per course.
 * Boundaries were confirmed against the real JNTUK R23 CSE PDF (docs/curriculum-pdf-extraction-audit.md): tables begin
 * "B.Tech.– II Year I Semester"; course sections begin "II Year I Semester" (title on the same or following lines).
 */
import { parseCourseSection, type ParsedSection } from "./section";

const ROMAN: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8 };
const YS = "(I{1,3}|IV|VI?)\\s+Year\\s*[–—-]?\\s*(I{1,2})\\s+Semester";
const TABLE_HEADING = new RegExp(`^B\\.?\\s*Tech\\.?\\s*[–—-]?\\s*${YS}\\s*$`, "i");
const COURSE_HEADING = new RegExp(`^${YS}\\b\\s*(.*)$`, "i");
const TITLE_STOP = /^(L\s+T\s+P\s+C\b|\d+\s+\d+\s+\d+\s+\d|Pre-?requisites?|Course Objectives?|Course Outcomes?|Common to\b|\(Common to)/i;
const MAX_SECTION_CHARS = 12_000;

/**
 * The other common layout (autonomous colleges, e.g. "MIC23"): semesters are numbered 1-8 with no year.
 *   table:  "B.TECH, I SEMESTER" then "S.No Course Category Course Code …" … "Total Number of Credits 19"
 *   course: "B.TECH I SEMESTER ES L T P C" / "3 0 0 3" / "23CS1T04 INTRODUCTION TO PROGRAMMING" / "Course Objectives:" …
 * A semester number n maps to year ceil(n/2), semester ((n-1) mod 2)+1.
 */
const SEM = "(VIII|VII|VI|IV|V|III|II|I)";
const SEM_HEADING = new RegExp(`^B\\.?\\s*Tech\\.?\\s*(,?)\\s*${SEM}\\s+Semester\\b\\s*(.*)$`, "i");
const COURSE_CODE_TITLE = /^(?=[A-Z0-9-]*\d)(?=[A-Z0-9-]*[A-Z])[A-Z0-9-]{6,14}\s+(\S.{2,})$/;
/** Open electives are pools shared across branches; they are not this branch's own courses. */
const OPEN_ELECTIVE = /^OE\b/i;
const yearSemOf = (n: number) => ({ year: Math.ceil(n / 2), semester: ((n - 1) % 2) + 1 });

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
  /** the PDF pages (1-based) this section was read from */
  pageStart?: number;
  pageEnd?: number;
}

const parseYs = (y: string, s: string) => ({ year: ROMAN[y.toUpperCase()] ?? 0, semester: ROMAN[s.toUpperCase()] ?? 0 });

type Boundary = { line: number; kind: "table" | "course"; year: number; semester: number; rest: string; /** semester-numbered layout: the title follows a course-code line */ coded?: boolean };

/** True when a "S.No … Course Code" table header follows within the next few non-empty lines. */
function tableHeaderFollows(lines: string[], from: number): boolean {
  let seen = 0;
  for (let i = from + 1; i < lines.length && seen < 3; i++) {
    const t = lines[i].trim();
    if (!t) continue;
    if (/^S\.?\s*No\b/i.test(t)) return true;
    seen++;
  }
  return false;
}

function boundaries(lines: string[]): Boundary[] {
  const out: Boundary[] = [];
  lines.forEach((raw, line) => {
    const t = raw.trim();
    const sem = SEM_HEADING.exec(t);
    if (sem && ROMAN[sem[2].toUpperCase()]) {
      const rest = (sem[3] ?? "").trim();
      const isTable = rest === "" && (sem[1] === "," || tableHeaderFollows(lines, line));
      return void out.push({ line, kind: isTable ? "table" : "course", ...yearSemOf(ROMAN[sem[2].toUpperCase()]), rest, coded: true });
    }
    const table = TABLE_HEADING.exec(t);
    if (table) return void out.push({ line, kind: "table", ...parseYs(table[1], table[2]), rest: "" });
    const course = COURSE_HEADING.exec(t);
    if (course && !/^B\.?\s*Tech/i.test(t)) out.push({ line, kind: "course", ...parseYs(course[1], course[2]), rest: (course[3] ?? "").trim() });
  });
  return out.filter((b) => b.year >= 1 && b.year <= 4 && b.semester >= 1 && b.semester <= 2);
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

/** Course title for the semester-numbered layout: the first "CODE  TITLE" line after the heading (the L-T-P-C numbers come before it). */
function codedTitleOf(lines: string[], from: number, to: number): string {
  for (let i = from + 1; i < Math.min(to, from + 8); i++) {
    const m = COURSE_CODE_TITLE.exec(lines[i].trim());
    if (!m) continue;
    const parts = [m[1]];
    // a long title wraps onto following upper-case lines
    for (let j = i + 1; j < Math.min(to, i + 3); j++) {
      const t = lines[j].trim();
      if (!t || TITLE_STOP.test(t) || /[a-z]/.test(t) || t.length > 60 || /^(SYLLABUS|UNIT)\b/i.test(t)) break;
      parts.push(t);
    }
    return parts.join(" ").replace(/\s+/g, " ").trim();
  }
  return "";
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
  // line index -> 1-based page number, so every section can say where in the PDF it came from
  const pageOfLine: number[] = [];
  pages.forEach((p, i) => { for (let n = p.split(/\r?\n/).length; n > 0; n--) pageOfLine.push(i + 1); });
  const pageAt = (line: number) => pageOfLine[Math.min(line, pageOfLine.length - 1)] ?? 1;
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
    if (b.coded && OPEN_ELECTIVE.test(b.rest)) return;
    const sectionLines = lines.slice(b.line, end);
    const title = b.coded ? codedTitleOf(lines, b.line, end) : titleOf(lines, b.line, b.rest, end);
    if (title.length < 3) return;
    const text = sectionLines.join("\n").slice(0, MAX_SECTION_CHARS);
    const parsed = parseCourseSection(text.split("\n"));
    courses.push({ year: b.year, semester: b.semester, title, outcomes: parsed.outcomes.map((o) => o.text), text, parsed, pageStart: pageAt(b.line), pageEnd: pageAt(Math.max(b.line, end - 1)) });
  });
  return { tables: [...tableByKey.values()], courses };
}
