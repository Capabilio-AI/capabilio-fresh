/**
 * Pure. Layout-agnostic recognition of a semester heading, so a new college's PDF does not need new code.
 * Reads "B.TECH, I SEMESTER", "SEMESTER - III", "3rd Semester", "Sem 4", "First Semester" ... into a semester number 1-8.
 * Lines naming a year ("II Year I Semester", the JNTUK layout) are left to the year-based patterns in chunk.ts.
 * A heading alone proves nothing (prose can start "Semester I examinations ..."): callers confirm it by what follows.
 */
const ROMANS: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8 };
const WORDS: Record<string, number> = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8 };

const PROGRAMME = String.raw`(?:B\.?\s*Tech\.?|B\.?\s*E\.?|M\.?\s*Tech\.?|MCA|MBA|Diploma)`;
const NUM = String.raw`(VIII|VII|VI|IV|V|III|II|I|\d{1,2}|first|second|third|fourth|fifth|sixth|seventh|eighth)`;
const SEP = String.raw`\s*[,:–—-]?\s*`;
const SEM = String.raw`sem(?:ester)?\b`;
const NUMBER_FIRST = new RegExp(`^(?:${PROGRAMME})?${SEP}${NUM}(?:st|nd|rd|th)?\\s*[-–—]?\\s*${SEM}\\s*(.*)$`, "i");
const SEMESTER_FIRST = new RegExp(`^(?:${PROGRAMME})?${SEP}${SEM}\\s*[-–—:.]?\\s*${NUM}\\b\\s*(.*)$`, "i");

export interface SemesterHeading {
  /** 1-8 */
  n: number;
  /** what follows the semester phrase on the same line (a category, "L T P C", "COURSE STRUCTURE" ...) */
  rest: string;
}

function numberOf(token: string): number {
  const t = token.toLowerCase();
  const n = /^\d+$/.test(t) ? Number(t) : (WORDS[t] ?? ROMANS[token.toUpperCase()] ?? 0);
  return n >= 1 && n <= 8 ? n : 0;
}

export function parseSemesterHeading(raw: string): SemesterHeading | null {
  const line = raw.trim();
  if (line.length === 0 || line.length > 90 || /\byear\b/i.test(line)) return null;
  const a = NUMBER_FIRST.exec(line);
  const b = a ? null : SEMESTER_FIRST.exec(line);
  const m = a ?? b;
  if (!m) return null;
  const n = numberOf(m[1]);
  if (!n) return null;
  return { n, rest: (m[2] ?? "").trim() };
}

const HEADER_HINTS = [/\bS\.?\s*No\b|\bSl\.?\s*No\b|\bSr\.?\s*No\b/i, /\b(course|subject|paper)\s*code\b/i, /\bcredits?\b/i, /\bL\s*[-–]?\s*T\s*[-–]?\s*P\b/i, /\b(max(imum)?\s*)?marks\b|\binternal\b|\bexternal\b/i];

/** True when the next few lines look like the header row of a course table (at least two of: S.No, course code, credits, L-T-P, marks). */
export function tableHeaderFollows(lines: string[], from: number): boolean {
  const window = lines.slice(from + 1, from + 12).filter((l) => l.trim()).slice(0, 6).join(" ");
  return HEADER_HINTS.filter((re) => re.test(window)).length >= 2;
}

/** A trailing "COURSE STRUCTURE" / "SCHEME" / "SYLLABUS" on a table heading is decoration, not a category. */
export const TABLE_HEADING_TAIL = /^(?:[-–—:,]\s*)?(course\s+structure|scheme(?:\s+of\s+\w+)?|syllabus|curriculum)?\s*$/i;
