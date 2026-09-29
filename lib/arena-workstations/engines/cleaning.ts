import { z } from "zod";
import { cellsEqual, type Cell, type Dataset } from "./dataset";

// Power-Query-style applied steps. A closed set: the candidate builds a step
// list, the server applies it to the raw data, and the result is compared
// with the result of the expected step list. Different step lists that
// produce the same clean table both pass.

export const DATE_FORMATS = ["DD/MM/YYYY", "MM/DD/YYYY", "DD-MM-YYYY", "YYYY/MM/DD", "YYYY-MM-DD"] as const;
const FILTER_OPERATORS = [">", ">=", "<", "<=", "=", "!="] as const;

export const CleaningStepSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("trim"), column: z.string() }),
  z.object({ op: z.literal("lowercase"), column: z.string() }),
  z.object({ op: z.literal("titlecase"), column: z.string() }),
  z.object({ op: z.literal("replace"), column: z.string(), from: z.string().max(80), to: z.string().max(80) }),
  z.object({ op: z.literal("to_number"), column: z.string() }),
  z.object({ op: z.literal("to_date"), column: z.string(), format: z.enum(DATE_FORMATS) }),
  z.object({ op: z.literal("drop_missing"), column: z.string() }),
  z.object({ op: z.literal("dedupe"), columns: z.array(z.string()).min(1).max(4) }),
  z.object({ op: z.literal("filter"), column: z.string(), operator: z.enum(FILTER_OPERATORS), value: z.union([z.number(), z.string().max(80)]) }),
]);
export type CleaningStep = z.infer<typeof CleaningStepSchema>;

export const STEP_LABELS: Record<CleaningStep["op"], string> = {
  trim: "Trim whitespace",
  lowercase: "Lowercase",
  titlecase: "Title Case",
  replace: "Replace value",
  to_number: "Convert to number",
  to_date: "Convert to date (YYYY-MM-DD)",
  drop_missing: "Remove rows with missing values",
  dedupe: "Remove duplicate rows",
  filter: "Keep rows where…",
};

function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase());
}

export function parseNumber(v: Cell): number | null {
  if (typeof v === "number") return v;
  if (v === null) return null;
  const cleaned = v.replace(/[₹$€£,\s]/g, "").replace(/^rs\.?/i, "");
  if (cleaned === "" || !/^-?\d*\.?\d+$/.test(cleaned)) return null;
  return Number(cleaned);
}

export function parseDate(v: Cell, format: (typeof DATE_FORMATS)[number]): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return validIso(s);
  const parts = s.split(/[/-]/).map(Number);
  if (parts.length !== 3 || parts.some((p) => !Number.isInteger(p))) return null;
  let y: number, m: number, d: number;
  switch (format) {
    case "DD/MM/YYYY":
    case "DD-MM-YYYY":
      [d, m, y] = parts;
      break;
    case "MM/DD/YYYY":
      [m, d, y] = parts;
      break;
    default:
      [y, m, d] = parts;
  }
  return validIso(`${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
}

function validIso(iso: string): string | null {
  const t = Date.parse(`${iso}T00:00:00Z`);
  return Number.isNaN(t) || new Date(t).toISOString().slice(0, 10) !== iso ? null : iso;
}

const isMissing = (v: Cell) => v === null || (typeof v === "string" && v.trim() === "");

function compare(v: Cell, operator: (typeof FILTER_OPERATORS)[number], target: number | string): boolean {
  if (v === null) return false;
  if (typeof target === "number") {
    const n = typeof v === "number" ? v : parseNumber(v);
    if (n === null) return false;
    switch (operator) {
      case ">": return n > target;
      case ">=": return n >= target;
      case "<": return n < target;
      case "<=": return n <= target;
      case "=": return n === target;
      case "!=": return n !== target;
    }
  }
  const a = String(v);
  const b = String(target);
  switch (operator) {
    case "=": return a === b;
    case "!=": return a !== b;
    case ">": return a > b;
    case ">=": return a >= b;
    case "<": return a < b;
    case "<=": return a <= b;
  }
}

/** Pure. Applies one step; throws on an unknown column (the UI only offers real ones). */
export function applyStep(ds: Dataset, step: CleaningStep): Dataset {
  const col = (name: string) => {
    const i = ds.columns.findIndex((c) => c.name === name);
    if (i === -1) throw new Error(`Unknown column ${name}`);
    return i;
  };
  const mapColumn = (name: string, fn: (v: Cell) => Cell): Dataset => {
    const i = col(name);
    return { ...ds, rows: ds.rows.map((r) => r.map((v, j) => (j === i ? fn(v) : v))) };
  };

  switch (step.op) {
    case "trim": return mapColumn(step.column, (v) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ") : v));
    case "lowercase": return mapColumn(step.column, (v) => (typeof v === "string" ? v.toLowerCase() : v));
    case "titlecase": return mapColumn(step.column, (v) => (typeof v === "string" ? titleCase(v) : v));
    case "replace": return mapColumn(step.column, (v) => (v === step.from ? step.to : v));
    case "to_number": return mapColumn(step.column, parseNumber);
    case "to_date": return mapColumn(step.column, (v) => parseDate(v, step.format));
    case "drop_missing": {
      const i = col(step.column);
      return { ...ds, rows: ds.rows.filter((r) => !isMissing(r[i])) };
    }
    case "dedupe": {
      const idx = step.columns.map(col);
      const seen = new Set<string>();
      return {
        ...ds,
        rows: ds.rows.filter((r) => {
          const key = JSON.stringify(idx.map((i) => r[i]));
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        }),
      };
    }
    case "filter": {
      const i = col(step.column);
      return { ...ds, rows: ds.rows.filter((r) => compare(r[i], step.operator, step.value)) };
    }
  }
}

export function applySteps(ds: Dataset, steps: CleaningStep[]): Dataset {
  return steps.reduce(applyStep, ds);
}

/** Pure. Order-insensitive row-multiset comparison; text must match exactly (casing/whitespace are the point of cleaning). */
export function compareCleanTables(expected: Dataset, actual: Dataset): { passed: boolean; message: string; missingRows: number; extraRows: number } {
  const remaining = [...actual.rows];
  let missing = 0;
  for (const row of expected.rows) {
    const idx = remaining.findIndex((r) => r.length === row.length && r.every((v, j) => cellsEqual(v, row[j], { abs: 1e-6, exactText: true })));
    if (idx === -1) missing++;
    else remaining.splice(idx, 1);
  }
  const extra = remaining.length;
  const passed = missing === 0 && extra === 0;
  const message = passed
    ? "Your cleaned table matches."
    : `Your cleaned table has ${actual.rows.length} rows; ${missing} expected row${missing === 1 ? " is" : "s are"} missing or different and ${extra} row${extra === 1 ? " doesn't" : "s don't"} belong. Check each requirement.`;
  return { passed, message, missingRows: missing, extraRows: extra };
}

/** Pure. Steps that change nothing make a generated task meaningless — generation rejects them. */
export function noOpSteps(ds: Dataset, steps: CleaningStep[]): number[] {
  const out: number[] = [];
  let current = ds;
  steps.forEach((step, i) => {
    const next = applyStep(current, step);
    if (JSON.stringify(next.rows) === JSON.stringify(current.rows)) out.push(i);
    current = next;
  });
  return out;
}

/** Pure. The requirement line shown to the candidate for one expected step. */
export function describeStep(step: CleaningStep): string {
  switch (step.op) {
    case "trim": return `\`${step.column}\` has stray spaces — remove leading/trailing whitespace and collapse repeated spaces.`;
    case "lowercase": return `\`${step.column}\` must be all lower-case.`;
    case "titlecase": return `\`${step.column}\` must be in Title Case.`;
    case "replace": return `In \`${step.column}\`, the value "${step.from}" must become "${step.to}".`;
    case "to_number": return `\`${step.column}\` must be a real number (strip currency symbols, commas and spaces; anything unparseable becomes empty).`;
    case "to_date": return `\`${step.column}\` arrives as ${step.format}; convert it to YYYY-MM-DD (invalid dates become empty).`;
    case "drop_missing": return `Rows with no \`${step.column}\` can't be used — remove them.`;
    case "dedupe": return `Remove duplicate records — rows with the same ${step.columns.map((c) => `\`${c}\``).join(" + ")} (keep the first).`;
    case "filter": return `Keep only rows where \`${step.column}\` ${step.operator} ${typeof step.value === "number" ? step.value : `"${step.value}"`}.`;
  }
}
