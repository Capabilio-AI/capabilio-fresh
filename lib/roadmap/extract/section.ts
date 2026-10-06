/**
 * Pure. Reads ONE course section of a syllabus (lines between two course headings) into structured fields. Deterministic: every
 * field is copied from the text or left empty — nothing is inferred. Each extracted field keeps a raw snippet as provenance.
 * Headings were verified against the real JNTUK R23 CSE PDF (62 sections); other layouts that yield nothing report `complete: false`
 * so the caller can fall back to the AI structurer (which is grounded against this same text).
 */
export type Bloom = "Remember" | "Understand" | "Apply" | "Analyze" | "Evaluate" | "Create";

export interface ParsedOutcome {
  code: string;
  text: string;
  bloom: Bloom | null;
}
export interface ParsedUnit {
  unitNo: number;
  title: string;
  hours: number | null;
  topics: string[];
}
export interface ParsedSection {
  /** credits `c` is null when the syllabus prints "-" */
  ltpc: { l: number; t: number; p: number; c: number | null } | null;
  prerequisites: string | null;
  objectives: string[];
  outcomes: ParsedOutcome[];
  units: ParsedUnit[];
  experiments: string[];
  textbooks: string[];
  referenceBooks: string[];
  onlineResources: string[];
  /** field -> the raw source text it came from (≤400 chars) */
  provenance: Record<string, string>;
  /** at least one of outcomes / units / experiments was found */
  complete: boolean;
}

const BLOOM: Bloom[] = ["Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"];
/** K1–K6 (or L1–L6) as printed after a course outcome. */
export function bloomFromK(tag: string | null | undefined): Bloom | null {
  const m = /^[KL]([1-6])$/i.exec(tag?.trim() ?? "");
  return m ? BLOOM[Number(m[1]) - 1] : null;
}

const ROMAN: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10 };
const BULLET = /^[•●▪·*-]\s*/;
const NUMBERED = /^(\d{1,2})\s*[.)]\s*(.*)$/;
const SNIPPET = 400;

const H = {
  objectives: /^Course Objectives?\b\s*:?\s*(.*)$/i,
  outcomes: /^Course Outcomes?\b.*$/i,
  unit: /^UNIT\s*[-–—:]?\s*([IVX]+|\d+)\s*[:.\-–—]?\s*(.*)$/i,
  experiments: /^(List of Experiments|Sample Experiments)\b.*$/i,
  labTopics: /^Experiments covering the topics\b.*$/i,
  textbooks: /^(?:Text ?Books?|Textbooks?)\b(?:\s*(?:\/|and)\s*[^:]*)?\s*:?\s*(.*)$/i,
  references: /^(?:Reference Books?|References?)\b\s*:?\s*(.*)$/i,
  online: /^(?:Online Learning Resources|Web-?\s?Resources|e-?\s?Resources[^:]*|Web References|Online Resources)\b\s*:?\s*(.*)$/i,
  prereq: /^Pre-?requisites?\b\s*:?\s*(.*)$/i,
  // "L T P C" usually trails the course title line, sometimes stands alone
  ltpc: /(?:^|\s)L\s+T\s+P\s+C\b\s*(.*)$/i,
};
const LTPC_NUMBERS = /^(\d+(?:\.\d)?)\s+(\d+(?:\.\d)?)\s+(\d+(?:\.\d)?)\s+(\d+(?:\.\d)?|-)$/;
// the CO/PO mapping matrix ("PO1 PO2 …" header, "CO1 H M L …" rows) and the "Note:" lines are never content
const NOISE = /^(PO\s?\d+\b[\sPOS\d]*$|CO\s?\d+\s+[HML-](\s+[HML-])+\s*$|Note\s*:)/i;
const OUTCOME_ITEM = /^(CO\s?(\d+)\s*[:.–—-]|\d{1,2}\s*[.)]|[•●▪·*-])\s*(.*)$/i;
const OUTCOME_STOP = /^(PO\s?\d+\b|UNIT\b|List of Experiments|Course Content|Text ?Books?|Reference|Syllabus|Experiment|Week\b)/i;

type Mode = "none" | "objectives" | "outcomes" | "unit" | "experiments" | "labTopics" | "textbooks" | "references" | "online" | "prereq";

const clean = (s: string) => s.replace(/\s+/g, " ").trim();
const snippet = (lines: string[]) => clean(lines.join(" ")).slice(0, SNIPPET);

function splitTopLevel(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "(" || ch === "[") depth++;
    if (ch === ")" || ch === "]") depth = Math.max(0, depth - 1);
    const sentenceEnd = ch === "." && depth === 0 && /\s/.test(text[i + 1] ?? " ") && /[A-Z]/.test(text.slice(i + 1).trimStart()[0] ?? "");
    if (depth === 0 && (ch === "," || ch === ";" || sentenceEnd)) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

function unitFrom(unitNo: number, headRest: string, bodyLines: string[]): ParsedUnit {
  const body = clean([headRest, ...bodyLines].join(" "));
  const hours = /\(\s*(\d+(?:\.\d)?)\s*(?:hours?|hrs?)\s*\)/i.exec(body);
  const withoutHours = body.replace(/\(\s*\d+(?:\.\d)?\s*(?:hours?|hrs?)\s*\)/gi, " ");
  // "Label: text" headings inside a unit name a sub-area; the first one names the unit
  const label = /^([A-Z][^:.;,]{2,80}):\s/.exec(withoutHours);
  const stripped = withoutHours.replace(/(^|[.;]\s+)([A-Z][^:.;,]{2,80}):\s+/g, "$1");
  const seen = new Set<string>();
  const topics = splitTopLevel(stripped)
    .map((t) => clean(t).replace(/[.:]+$/, ""))
    .filter((t) => t.length >= 3 && t.length <= 200 && !/^(and|etc)$/i.test(t))
    .filter((t) => (seen.has(t.toLowerCase()) ? false : (seen.add(t.toLowerCase()), true)))
    .slice(0, 60);
  return { unitNo, title: label ? clean(label[1]) : `Unit ${unitNo}`, hours: hours ? Number(hours[1]) : null, topics };
}

function listItems(lines: string[], opts: { joinUrls: boolean }): string[] {
  const items: string[] = [];
  const numbered = lines.some((l) => NUMBERED.test(l));
  for (const raw of lines) {
    const t = raw.trim();
    if (!t) continue;
    const m = NUMBERED.exec(t);
    const startsItem = numbered ? Boolean(m) && !/^[ivx]+$/i.test(m![1]) : /^[A-Z0-9]/.test(t) && items.length === 0 ? true : !numbered && /^[A-Z]/.test(t);
    if (startsItem) items.push(clean(m ? m[2] : t));
    else if (items.length > 0) {
      const last = items[items.length - 1];
      const urlWrap = opts.joinUrls && /https?:\/\/\S*$/.test(last) && !/\s/.test(t);
      items[items.length - 1] = urlWrap ? `${last}${t}` : clean(`${last} ${t}`);
    }
  }
  return items.filter((i) => i.length > 2);
}

export function parseCourseSection(sectionLines: string[]): ParsedSection {
  const buckets: Record<Mode, string[]> = { none: [], objectives: [], outcomes: [], unit: [], experiments: [], labTopics: [], textbooks: [], references: [], online: [], prereq: [] };
  const units: { no: number; tag: string; rest: string; lines: string[] }[] = [];
  let ltpc: ParsedSection["ltpc"] = null;
  let prereqInline = "";
  let mode: Mode = "none";

  const lines = sectionLines.map((l) => l.trim());
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i];
    if (!t) continue;
    if (H.ltpc.test(t)) {
      const nums = LTPC_NUMBERS.exec(lines[i + 1] ?? "") ?? LTPC_NUMBERS.exec(H.ltpc.exec(t)![1].trim());
      if (nums && !ltpc) ltpc = { l: Number(nums[1]), t: Number(nums[2]), p: Number(nums[3]), c: nums[4] === "-" ? null : Number(nums[4]) };
      if (LTPC_NUMBERS.test(lines[i + 1] ?? "")) i++;
      continue;
    }
    if (NOISE.test(t)) continue;

    let m: RegExpExecArray | null;
    if ((m = H.objectives.exec(t))) { mode = "objectives"; if (m[1]) buckets.objectives.push(m[1]); continue; }
    if (H.outcomes.test(t)) { mode = "outcomes"; continue; }
    if ((m = H.unit.exec(t))) { mode = "unit"; units.push({ no: ROMAN[m[1].toUpperCase()] ?? Number(m[1]), tag: m[1], rest: m[2] ?? "", lines: [] }); continue; }
    if (H.experiments.test(t)) { mode = "experiments"; continue; }
    if (H.labTopics.test(t)) { mode = "labTopics"; continue; }
    if ((m = H.prereq.exec(t))) { mode = "prereq"; prereqInline = m[1]; continue; }
    if ((m = H.textbooks.exec(t))) { mode = "textbooks"; if (m[1]) buckets.textbooks.push(m[1]); continue; }
    if ((m = H.references.exec(t))) { mode = "references"; if (m[1]) buckets.references.push(m[1]); continue; }
    if ((m = H.online.exec(t))) { mode = "online"; if (m[1]) buckets.online.push(m[1]); continue; }

    if (mode === "unit") units[units.length - 1].lines.push(t);
    else buckets[mode].push(t);
  }

  // Course outcomes: "CO1: …", "1. …", or a bullet; wrapped lines continue the previous outcome; "(K3)" is the Bloom tag.
  const outcomes: ParsedOutcome[] = [];
  const raw: { code: string | null; text: string }[] = [];
  for (const t of buckets.outcomes) {
    if (OUTCOME_STOP.test(t)) break;
    const m = OUTCOME_ITEM.exec(t);
    if (m) raw.push({ code: m[2] ? `CO${m[2]}` : null, text: (m[3] ?? "").trim() });
    else if (raw.length > 0) raw[raw.length - 1].text += ` ${t}`;
  }
  raw.slice(0, 12).forEach((r, i) => {
    const k = /\(\s*([KL]\d)\s*\)\s*$/i.exec(r.text);
    const text = clean(r.text.replace(/\s*\(\s*[KL]\d\s*\)\s*$/i, ""));
    if (text.length > 8) outcomes.push({ code: r.code ?? `CO${i + 1}`, text, bloom: bloomFromK(k?.[1]) });
  });

  const objectives: string[] = [];
  for (const t of buckets.objectives) {
    const isItem = BULLET.test(t) || NUMBERED.test(t) || /^To\s/.test(t);
    const text = t.replace(BULLET, "").replace(NUMBERED, "$2");
    if (isItem) objectives.push(clean(text));
    else if (objectives.length > 0) objectives[objectives.length - 1] = clean(`${objectives[objectives.length - 1]} ${text}`);
    // else: the lead-in sentence ("The objectives of this course are to …") is not an objective
  }

  const prereqText = clean([prereqInline, ...buckets.prereq].join(" "));
  const numberedExperiments = listItems(buckets.experiments, { joinUrls: false });
  let parsedUnits = units.filter((u) => Number.isFinite(u.no) && u.no >= 1).map((u) => unitFrom(u.no, u.rest, u.lines));
  // A section that repeats "UNIT I" (two syllabi merged by a missed heading) is numbered by order of appearance; the raw text stays in provenance.
  if (new Set(parsedUnits.map((u) => u.unitNo)).size !== parsedUnits.length) parsedUnits = parsedUnits.map((u, i) => ({ ...u, unitNo: i + 1 }));
  const section: ParsedSection = {
    ltpc,
    prerequisites: prereqText && !/^(nil|none|n\/a|-)$/i.test(prereqText) ? prereqText.slice(0, 500) : null,
    objectives: objectives.filter((o) => o.length > 3),
    outcomes,
    units: parsedUnits,
    experiments: numberedExperiments.length > 0 ? numberedExperiments : buckets.labTopics.map((l) => clean(l.replace(BULLET, ""))).filter((l) => l.length > 3),
    textbooks: listItems(buckets.textbooks, { joinUrls: false }),
    referenceBooks: listItems(buckets.references, { joinUrls: false }),
    onlineResources: listItems(buckets.online, { joinUrls: true }),
    provenance: {},
    complete: false,
  };
  section.complete = outcomes.length > 0 || parsedUnits.length > 0 || section.experiments.length > 0;
  const prov: [string, string[]][] = [
    ["objectives", buckets.objectives], ["outcomes", buckets.outcomes], ["experiments", buckets.experiments], ["textbooks", buckets.textbooks],
    ["references", buckets.references], ["online", buckets.online], ["prerequisites", prereqInline ? [prereqInline, ...buckets.prereq] : buckets.prereq],
    ["units", units.flatMap((u) => [`UNIT ${u.tag}`, u.rest, ...u.lines])],
  ];
  for (const [field, src] of prov) if (src.some((s) => s.trim())) section.provenance[field] = snippet(src);
  if (section.outcomes.length === 0) delete section.provenance.outcomes;
  if (section.units.length === 0) delete section.provenance.units;
  return section;
}
