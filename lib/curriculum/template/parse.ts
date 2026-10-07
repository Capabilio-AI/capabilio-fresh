import { parseCsv } from "./csv";
import { BOOK_KINDS, COLUMNS, EXAMPLE_MARKER, IMPORTANCE, KINDS, REQUIRED_COLUMNS, ROW_TYPES, type Column, type RowType } from "./spec";

export const BLOOM = ["Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"] as const;
export type Bloom = (typeof BLOOM)[number];
export type Kind = (typeof KINDS)[number];
export type Importance = (typeof IMPORTANCE)[number];

export interface TemplateIssue {
  /** 1-based line in the uploaded file; 0 for a problem with the file as a whole */
  line: number;
  message: string;
}

export type SkillScope = { type: "course" } | { type: "outcome"; code: string } | { type: "unit"; unitNo: number };
export interface TemplateCourse {
  line: number;
  code: string;
  title: string;
  year: number;
  semester: number;
  kind: Kind;
  category: string | null;
  credits: number | null;
  lecture: number | null;
  tutorial: number | null;
  practical: number | null;
  prerequisites: string | null;
  objectives: string[];
  outcomes: { code: string; text: string; bloom: Bloom | null }[];
  units: { unitNo: number; title: string; hours: number | null; topics: string[] }[];
  experiments: string[];
  textbooks: string[];
  referenceBooks: string[];
  onlineResources: string[];
  skills: { line: number; name: string; scope: SkillScope; importance: Importance | null }[];
}

/** `notes` are non-blocking: something in the file was ignored. */
export type ParsedTemplate = { ok: true; courses: TemplateCourse[]; notes: TemplateIssue[] } | { ok: false; issues: TemplateIssue[] };

export const LIMITS = { rows: 30000, courses: 400, issues: 60 } as const;
const LAB = /\blab(oratory)?\b/i;
const num = (v: string): number | null => (v.trim() === "" ? null : Number(v.replace(",", ".")));
const has = <T extends string>(list: readonly T[], v: string): v is T => (list as readonly string[]).includes(v);

/** "K1".."K6" as printed after an outcome, or a Bloom word in any case. */
export function bloomOf(v: string): Bloom | null {
  const t = v.trim();
  if (!t) return null;
  const k = /^[KL]([1-6])$/i.exec(t);
  if (k) return BLOOM[Number(k[1]) - 1];
  return BLOOM.find((b) => b.toLowerCase() === t.toLowerCase()) ?? null;
}

function resolveTerm(yearRaw: string, semRaw: string): { year: number; semester: number } | string {
  const year = num(yearRaw);
  const sem = num(semRaw);
  if (sem === null || !Number.isInteger(sem)) return "semester is missing or not a whole number";
  if (year === null) {
    if (sem < 1 || sem > 12) return "semester must be 1-8 when year is empty";
    return { year: Math.ceil(sem / 2), semester: ((sem - 1) % 2) + 1 };
  }
  if (!Number.isInteger(year) || year < 1 || year > 6) return "year must be a whole number from 1 to 6";
  if (sem !== 1 && sem !== 2) return "semester must be 1 or 2 when year is given";
  return { year, semester: sem };
}

/** Pure. Reads the whole file and reports every problem it can find in one pass, so a college fixes the file once. */
export function parseCurriculumTemplate(text: string): ParsedTemplate {
  const issues: TemplateIssue[] = [];
  const issue = (line: number, message: string) => void (issues.length <= LIMITS.issues && issues.push({ line, message }));

  const rows = parseCsv(text).filter((r) => !r.cells[0].startsWith("#"));
  if (rows.length === 0) return { ok: false, issues: [{ line: 0, message: "The file is empty." }] };
  if (rows.length > LIMITS.rows) return { ok: false, issues: [{ line: 0, message: `At most ${LIMITS.rows} rows per file. Split it by year if needed.` }] };

  const header = rows[0].cells.map((h) => h.toLowerCase().replace(/[\s-]+/g, "_"));
  const missing = REQUIRED_COLUMNS.filter((c) => !header.includes(c));
  if (missing.length > 0) return { ok: false, issues: [{ line: rows[0].line, message: `The header must include ${missing.join(" and ")}. Download the template for the exact columns.` }] };
  const col = (cells: string[], name: Column) => {
    const i = header.indexOf(name);
    return i < 0 ? "" : (cells[i] ?? "").trim();
  };
  const unknown = header.filter((h) => h && !(COLUMNS as readonly string[]).includes(h));
  if (unknown.length > 0) issue(rows[0].line, `Unknown column${unknown.length > 1 ? "s" : ""}: ${unknown.join(", ")}. ${unknown.length > 1 ? "They are" : "It is"} ignored.`);

  type Draft = { course: TemplateCourse };
  const byCode = new Map<string, Draft>();
  const body = rows.slice(1);
  const typeOf = (cells: string): RowType | null => (has(ROW_TYPES, cells.toUpperCase()) ? (cells.toUpperCase() as RowType) : null);

  // Pass 1: courses, so child rows may appear in any order.
  for (const r of body) {
    if (typeOf(col(r.cells, "row_type")) !== "COURSE") continue;
    const code = col(r.cells, "course_code");
    const title = col(r.cells, "course_title");
    if (!code) { issue(r.line, "COURSE row has no course_code."); continue; }
    if (!title) { issue(r.line, `${code}: course_title is missing.`); continue; }
    if (title.toUpperCase().startsWith(EXAMPLE_MARKER)) { issue(r.line, `${code}: this is one of the example rows. Delete the example courses and their rows before uploading.`); continue; }
    if (byCode.has(code.toLowerCase())) { issue(r.line, `${code}: course_code is used by another course (line ${byCode.get(code.toLowerCase())!.course.line}). Each code must be unique within the file.`); continue; }
    const term = resolveTerm(col(r.cells, "year"), col(r.cells, "semester"));
    if (typeof term === "string") { issue(r.line, `${code}: ${term}.`); continue; }
    const category = col(r.cells, "category") || null;
    const kindRaw = col(r.cells, "kind").toLowerCase();
    if (kindRaw && !has(KINDS, kindRaw)) { issue(r.line, `${code}: kind must be one of ${KINDS.join(", ")}.`); continue; }
    const kind: Kind = kindRaw ? (kindRaw as Kind) : LAB.test(title) ? "lab" : /elective/i.test(category ?? "") ? "elective_option" : "course";
    const hours = (["credits", "lecture_hours", "tutorial_hours", "practical_hours"] as const).map((c) => num(col(r.cells, c)));
    if (hours.some((h) => h !== null && (!Number.isFinite(h) || h < 0 || h > 40))) { issue(r.line, `${code}: credits and hours must be numbers from 0 to 40.`); continue; }
    byCode.set(code.toLowerCase(), {
      course: {
        line: r.line, code, title, ...term, kind, category, credits: hours[0], lecture: hours[1], tutorial: hours[2], practical: hours[3],
        prerequisites: col(r.cells, "prerequisites") || null, objectives: [], outcomes: [], units: [], experiments: [], textbooks: [], referenceBooks: [], onlineResources: [], skills: [],
      },
    });
  }
  if (byCode.size > LIMITS.courses) return { ok: false, issues: [{ line: 0, message: `At most ${LIMITS.courses} courses per file.` }] };

  // Pass 2: everything that hangs off a course. Units are read before the topics and skills that point at them, so row order never matters.
  const late = (r: { cells: string[] }) => (["TOPIC", "SKILL"].includes(col(r.cells, "row_type").toUpperCase()) ? 1 : 0);
  for (const r of [...body].sort((a, b) => late(a) - late(b))) {
    const rowType = col(r.cells, "row_type");
    const type = typeOf(rowType);
    if (!type) { issue(r.line, `row_type "${rowType}" is not one of ${ROW_TYPES.join(", ")}.`); continue; }
    if (type === "COURSE") continue;
    const code = col(r.cells, "course_code");
    const draft = byCode.get(code.toLowerCase());
    if (!draft) { issue(r.line, `${type}: course_code "${code}" does not match any COURSE row.`); continue; }
    const c = draft.course;
    const ref = col(r.cells, "ref");
    const t = col(r.cells, "text");
    const value = col(r.cells, "value");
    if (!t) { issue(r.line, `${code}: ${type} row has no text.`); continue; }

    if (type === "OBJECTIVE") c.objectives.push(t);
    else if (type === "LAB") c.experiments.push(t);
    else if (type === "OUTCOME") {
      const outcomeCode = (ref || `CO${c.outcomes.length + 1}`).toUpperCase();
      if (c.outcomes.some((o) => o.code === outcomeCode)) { issue(r.line, `${code}: outcome ${outcomeCode} is listed twice.`); continue; }
      const bloom = bloomOf(value);
      if (value && !bloom) issue(r.line, `${code}: "${value}" is not a Bloom level (Remember, Understand, Apply, Analyze, Evaluate, Create) or K1-K6. It is ignored.`);
      c.outcomes.push({ code: outcomeCode, text: t, bloom });
    } else if (type === "UNIT") {
      const unitNo = num(ref);
      if (unitNo === null || !Number.isInteger(unitNo) || unitNo < 1 || unitNo > 40) { issue(r.line, `${code}: UNIT needs a unit number (1-40) in ref.`); continue; }
      if (c.units.some((u) => u.unitNo === unitNo)) { issue(r.line, `${code}: unit ${unitNo} is listed twice.`); continue; }
      const hrs = num(value);
      c.units.push({ unitNo, title: t, hours: hrs !== null && Number.isFinite(hrs) && hrs >= 0 && hrs <= 40 ? hrs : null, topics: [] });
    } else if (type === "TOPIC") {
      const unitNo = num(ref);
      const unit = c.units.find((u) => u.unitNo === unitNo);
      if (!unit) { issue(r.line, `${code}: TOPIC refers to unit "${ref}", which has no UNIT row for this course.`); continue; }
      unit.topics.push(t);
    } else if (type === "BOOK") {
      const kind = ref.toLowerCase() || "text";
      if (!has(BOOK_KINDS, kind)) { issue(r.line, `${code}: BOOK ref must be text, reference or online.`); continue; }
      (kind === "text" ? c.textbooks : kind === "reference" ? c.referenceBooks : c.onlineResources).push(t);
    } else if (type === "SKILL") {
      const importance = value ? (value.toUpperCase() as Importance) : null;
      if (importance && !has(IMPORTANCE, importance)) { issue(r.line, `${code}: skill importance must be CORE, SUPPORTING or MINOR.`); continue; }
      let scope: SkillScope = { type: "course" };
      if (ref) {
        const asNo = num(ref);
        if (/^CO\d+$/i.test(ref)) scope = { type: "outcome", code: ref.toUpperCase() };
        else if (asNo !== null && Number.isInteger(asNo)) scope = { type: "unit", unitNo: asNo };
        else { issue(r.line, `${code}: SKILL ref must be empty, an outcome like CO1, or a unit number.`); continue; }
      }
      c.skills.push({ line: r.line, name: t, scope, importance });
    }
  }

  // A skill pinned to an outcome or unit must point at one that exists.
  for (const { course: c } of byCode.values()) {
    for (const s of c.skills) {
      if (s.scope.type === "outcome" && !c.outcomes.some((o) => o.code === (s.scope as { code: string }).code)) issue(s.line, `${c.code}: skill "${s.name}" refers to ${s.scope.code}, which is not an outcome of this course.`);
      if (s.scope.type === "unit" && !c.units.some((u) => u.unitNo === (s.scope as { unitNo: number }).unitNo)) issue(s.line, `${c.code}: skill "${s.name}" refers to unit ${s.scope.unitNo}, which has no UNIT row.`);
    }
  }

  if (byCode.size === 0 && issues.length === 0) issue(0, "No COURSE rows found.");
  const blocking = issues.filter((i) => !/is ignored\.$/.test(i.message));
  if (blocking.length > 0) return { ok: false, issues: issues.slice(0, LIMITS.issues) };
  return { ok: true, courses: [...byCode.values()].map((d) => d.course), notes: issues };
}
