/**
 * Pure. Splits syllabus text into (a) one chunk per semester course-structure table and (b) one section per course.
 * Boundaries were confirmed against the real JNTUK R23 CSE PDF (docs/curriculum-pdf-extraction-audit.md): tables begin
 * "B.Tech.– II Year I Semester"; course sections begin "II Year I Semester" (title on the same or following lines).
 */
import { parseCourseSection, type ParsedSection } from "./section";
import { parseSemesterHeading, tableHeaderFollows, TABLE_HEADING_TAIL } from "./semester-heading";

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

/** A semester heading starts a course section only if a course code, a "Course Title:" line or "L T P C" confirms it. */
const LABELLED_TITLE = /^(?:course|subject|paper)?\s*(?:title|name)(?:\s+of\s+the\s+(?:course|subject|paper))?\s*[:\-–]\s*(\S.*)$/i;
function courseFollows(lines: string[], from: number, rest: string): boolean {
  if (/\bL\s*T\s*P\s*C\b/i.test(rest)) return true;
  for (let i = from + 1; i < Math.min(lines.length, from + 8); i++) {
    const t = lines[i].trim();
    if (COURSE_CODE_TITLE.test(t) || LABELLED_TITLE.test(t)) return true;
  }
  return false;
}

function boundaries(lines: string[]): Boundary[] {
  const out: Boundary[] = [];
  lines.forEach((raw, line) => {
    const t = raw.trim();
    const table = TABLE_HEADING.exec(t);
    if (table) return void out.push({ line, kind: "table", ...parseYs(table[1], table[2]), rest: "" });
    const course = COURSE_HEADING.exec(t);
    if (course && !/^B\.?\s*Tech/i.test(t)) return void out.push({ line, kind: "course", ...parseYs(course[1], course[2]), rest: (course[3] ?? "").trim() });
    // Any other phrasing ("B.TECH, I SEMESTER", "Semester 3", "3rd Sem", "First Semester" ...): a number 1-8, confirmed by what follows.
    const sem = parseSemesterHeading(t);
    if (!sem) return;
    const where = yearSemOf(sem.n);
    if (TABLE_HEADING_TAIL.test(sem.rest) && tableHeaderFollows(lines, line)) return void out.push({ line, kind: "table", ...where, rest: "" });
    if (courseFollows(lines, line, sem.rest)) out.push({ line, kind: "course", ...where, rest: sem.rest, coded: true });
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
    const labelled = LABELLED_TITLE.exec(lines[i].trim());
    if (labelled) return labelled[1].replace(/\s+/g, " ").trim();
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

/**
 * Pure. A running header/footer (college name, "(Autonomous)", "Page 14") repeats on most pages; those lines are never content.
 * Only the first 3 and last 2 lines of a page are considered, and only when they recur on at least 30% of pages (and 5+ pages).
 */
export function stripRepeatedChrome(pages: string[]): string[] {
  if (pages.length < 5) return pages;
  const norm = (l: string) => l.trim().replace(/\d+/g, "#").replace(/\s+/g, " ");
  const edge = (p: string) => {
    const ls = p.split(/\r?\n/).map((l, i, all) => ({ l, i, n: all.length })).filter(({ l }) => l.trim());
    return [...ls.slice(0, 3), ...ls.slice(-2)];
  };
  const count = new Map<string, number>();
  for (const p of pages) for (const k of new Set(edge(p).map(({ l }) => norm(l)))) count.set(k, (count.get(k) ?? 0) + 1);
  const threshold = Math.max(5, Math.ceil(pages.length * 0.3));
  // a recurring heading-like line ("UNIT-I", a semester heading) is content even when it sits at a page edge
  const contentLike = (k: string) => parseSemesterHeading(k) !== null || /^(unit|course|syllabus|text ?books?|reference)/i.test(k);
  const chrome = new Set([...count].filter(([k, n]) => n >= threshold && k.length > 3 && !contentLike(k)).map(([k]) => k));
  if (chrome.size === 0) return pages;
  return pages.map((p) => {
    const keep = new Set(edge(p).filter(({ l }) => !chrome.has(norm(l))).map(({ i }) => i));
    const edgeIdx = new Set(edge(p).map(({ i }) => i));
    return p.split(/\r?\n/).filter((_, i) => !edgeIdx.has(i) || keep.has(i)).join("\n");
  });
}

export function chunkSyllabus(rawPages: string[]): { tables: SemesterChunk[]; courses: CourseSection[] } {
  const pages = stripRepeatedChrome(rawPages);
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
