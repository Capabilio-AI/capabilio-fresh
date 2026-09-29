import { z } from "zod";
import { cellsEqual, columnValues, type Cell, type Dataset } from "./dataset";
import { address, columnLetters, evaluateSheet, formulaReferencesCells, isError, parseAddress, type CellValue, type Sheet } from "./formula";

// Spreadsheet tasks are a closed set. The server lays the workbook out,
// computes every expected value straight from the data (independently of
// the formula engine), and grades by recalculating the candidate's formulas.

export const SheetTaskSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("row_formula"), header: z.string().min(1).max(40), op: z.enum(["multiply", "divide", "add", "subtract", "percent_change", "percent_of"]), left: z.string(), right: z.string(), decimals: z.number().int().min(0).max(2) }),
  z.object({ type: z.literal("lookup"), header: z.string().min(1).max(40), key_column: z.string() }),
  z.object({ type: z.literal("summary"), label: z.string().min(1).max(60), fn: z.enum(["SUM", "AVERAGE", "MAX", "MIN", "COUNT"]), column: z.string(), decimals: z.number().int().min(0).max(2) }),
  z.object({ type: z.literal("conditional_summary"), label: z.string().min(1).max(60), fn: z.enum(["SUMIF", "COUNTIF", "AVERAGEIF"]), criteria_column: z.string(), criteria_value: z.string().max(60), column: z.string(), decimals: z.number().int().min(0).max(2) }),
]);
export type SheetTask = z.infer<typeof SheetTaskSchema>;

export interface SpreadsheetContent {
  data: Dataset;
  lookup: Dataset | null; // two columns: key, value
  tasks: SheetTask[];
}

export interface TaskTarget {
  task: number;
  cells: string[];
  instruction: string;
}

export interface SheetLayout {
  cells: Sheet; // prefilled, locked cells
  locked: string[];
  targets: TaskTarget[];
  rows: number;
  cols: number;
}

const OP_TEXT: Record<string, (l: string, r: string) => string> = {
  multiply: (l, r) => `${l} × ${r}`,
  divide: (l, r) => `${l} ÷ ${r}`,
  add: (l, r) => `${l} + ${r}`,
  subtract: (l, r) => `${l} − ${r}`,
  percent_change: (l, r) => `the % change from ${l} to ${r}, i.e. (${r} − ${l}) ÷ ${l} × 100`,
  percent_of: (l, r) => `${l} as a % of ${r}, i.e. ${l} ÷ ${r} × 100`,
};
const FN_TEXT: Record<string, string> = { SUM: "total", AVERAGE: "average", MAX: "maximum", MIN: "minimum", COUNT: "count of values", SUMIF: "total", COUNTIF: "number of rows", AVERAGEIF: "average" };

/** Pure. Places the data, lookup table, task columns and summary block; renders each instruction from the task parameters. */
export function buildLayout(content: SpreadsheetContent): SheetLayout {
  const { data, lookup, tasks } = content;
  const cells: Sheet = {};
  const n = data.rows.length;
  const colOf = (name: string) => {
    const i = data.columns.findIndex((c) => c.name === name);
    if (i === -1) throw new Error(`Unknown column ${name}`);
    return i;
  };
  const ref = (name: string) => `${name} (column ${columnLetters(colOf(name))})`;

  data.columns.forEach((c, j) => (cells[address(j, 0)] = c.name));
  data.rows.forEach((row, i) => row.forEach((v, j) => (cells[address(j, i + 1)] = v === null ? "" : String(v))));

  let nextCol = data.columns.length;
  const rowTasks = tasks.map((t, i) => ({ t, i })).filter(({ t }) => t.type === "row_formula" || t.type === "lookup");
  const columnFor = new Map<number, number>();
  for (const { t, i } of rowTasks) {
    columnFor.set(i, nextCol);
    cells[address(nextCol, 0)] = (t as { header: string }).header;
    nextCol++;
  }

  let lookupStart = -1;
  if (lookup) {
    lookupStart = nextCol + 1;
    lookup.columns.forEach((c, j) => (cells[address(lookupStart + j, 0)] = c.name));
    lookup.rows.forEach((row, i) => row.forEach((v, j) => (cells[address(lookupStart + j, i + 1)] = v === null ? "" : String(v))));
  }

  const summaryTasks = tasks.map((t, i) => ({ t, i })).filter(({ t }) => t.type === "summary" || t.type === "conditional_summary");
  const summaryRow = n + 2;
  summaryTasks.forEach(({ t }, k) => (cells[address(0, summaryRow + k)] = (t as { label: string }).label));

  const targets: TaskTarget[] = tasks.map((t, i) => {
    if (t.type === "row_formula" || t.type === "lookup") {
      const col = columnFor.get(i)!;
      const letter = columnLetters(col);
      const cellsForTask = data.rows.map((_, r) => address(col, r + 1));
      const instruction =
        t.type === "row_formula"
          ? `Column ${letter} (“${t.header}”): for every row, calculate ${OP_TEXT[t.op](ref(t.left), ref(t.right))}, rounded to ${t.decimals} decimal${t.decimals === 1 ? "" : "s"}.`
          : `Column ${letter} (“${t.header}”): for every row, look up ${ref(t.key_column)} in the ${lookup?.columns[0].name}→${lookup?.columns[1].name} table (columns ${columnLetters(lookupStart)}–${columnLetters(lookupStart + 1)}) and return the ${lookup?.columns[1].name}.`;
      return { task: i, cells: cellsForTask, instruction };
    }
    const k = summaryTasks.findIndex((s) => s.i === i);
    const cell = address(1, summaryRow + k);
    const instruction =
      t.type === "summary"
        ? `${cell} (“${t.label}”): the ${FN_TEXT[t.fn]} of ${ref(t.column)}${t.fn === "COUNT" ? "" : `, rounded to ${t.decimals} decimal${t.decimals === 1 ? "" : "s"}`}.`
        : `${cell} (“${t.label}”): the ${FN_TEXT[t.fn]}${t.fn === "COUNTIF" ? "" : ` of ${ref(t.column)}`} for rows where ${ref(t.criteria_column)} is “${t.criteria_value}”${t.fn === "COUNTIF" ? "" : `, rounded to ${t.decimals} decimal${t.decimals === 1 ? "" : "s"}`}.`;
    return { task: i, cells: [cell], instruction };
  });

  const locked = Object.keys(cells);
  return { cells, locked, targets, rows: summaryRow + summaryTasks.length + 2, cols: Math.max(nextCol, lookupStart === -1 ? 0 : lookupStart + 2) + 1 };
}

const round = (x: number, d: number) => Math.round(x * Math.pow(10, d)) / Math.pow(10, d);
const num = (v: Cell): number | null => (typeof v === "number" ? v : null);

/** Pure. Expected value per target cell, computed from the data (not via the formula engine). Throws when the data can't support a task. */
export function computeExpectedCells(content: SpreadsheetContent, layout: SheetLayout): Record<string, number> {
  const { data, lookup, tasks } = content;
  const out: Record<string, number> = {};
  tasks.forEach((t, i) => {
    const target = layout.targets.find((x) => x.task === i)!;
    if (t.type === "row_formula") {
      const L = columnValues(data, t.left).map(num);
      const R = columnValues(data, t.right).map(num);
      target.cells.forEach((cell, r) => {
        const l = L[r];
        const rv = R[r];
        if (l === null || rv === null) throw new Error(`row ${r + 1} is missing ${t.left}/${t.right}`);
        let v: number;
        switch (t.op) {
          case "multiply": v = l * rv; break;
          case "add": v = l + rv; break;
          case "subtract": v = l - rv; break;
          case "divide":
            if (rv === 0) throw new Error("division by zero in data");
            v = l / rv;
            break;
          case "percent_change":
            if (l === 0) throw new Error("division by zero in data");
            v = ((rv - l) / l) * 100;
            break;
          case "percent_of":
            if (rv === 0) throw new Error("division by zero in data");
            v = (l / rv) * 100;
            break;
        }
        out[cell] = round(v, t.decimals);
      });
    } else if (t.type === "lookup") {
      if (!lookup || lookup.columns.length !== 2) throw new Error("lookup task needs a two-column lookup table");
      const map = new Map(lookup.rows.map((r) => [String(r[0]).trim().toLowerCase(), num(r[1])]));
      const keys = columnValues(data, t.key_column);
      target.cells.forEach((cell, r) => {
        const v = map.get(String(keys[r]).trim().toLowerCase());
        if (v === undefined || v === null) throw new Error(`lookup key ${keys[r]} has no numeric value`);
        out[cell] = v;
      });
    } else if (t.type === "summary") {
      const xs = columnValues(data, t.column).map(num).filter((x): x is number => x !== null);
      if (xs.length === 0) throw new Error(`${t.column} has no numbers`);
      const v = t.fn === "SUM" ? xs.reduce((s, x) => s + x, 0) : t.fn === "AVERAGE" ? xs.reduce((s, x) => s + x, 0) / xs.length : t.fn === "MAX" ? Math.max(...xs) : t.fn === "MIN" ? Math.min(...xs) : xs.length;
      out[target.cells[0]] = t.fn === "COUNT" ? v : round(v, t.decimals);
    } else {
      const crit = columnValues(data, t.criteria_column);
      const vals = columnValues(data, t.column).map(num);
      const picked: number[] = [];
      let count = 0;
      crit.forEach((c, r) => {
        if (String(c).trim().toLowerCase() !== t.criteria_value.trim().toLowerCase()) return;
        count++;
        if (vals[r] !== null) picked.push(vals[r] as number);
      });
      if (count === 0) throw new Error(`no rows have ${t.criteria_column} = ${t.criteria_value}`);
      const v = t.fn === "COUNTIF" ? count : t.fn === "SUMIF" ? picked.reduce((s, x) => s + x, 0) : picked.reduce((s, x) => s + x, 0) / picked.length;
      out[target.cells[0]] = t.fn === "COUNTIF" ? v : round(v, t.decimals);
    }
  });
  return out;
}

export const MAX_CANDIDATE_CELLS = 2000;

/** Pure. The workbook the server grades: locked cells always come from the instance, never from the submission. */
export function mergeSubmission(layout: SheetLayout, submitted: Record<string, string>): Sheet {
  const sheet: Sheet = { ...layout.cells };
  const locked = new Set(layout.locked);
  let count = 0;
  for (const [addr, raw] of Object.entries(submitted)) {
    if (count >= MAX_CANDIDATE_CELLS) break;
    const a = addr.toUpperCase();
    const parsed = parseAddress(a);
    if (!parsed || parsed.row > 500 || parsed.col > 60 || locked.has(a) || typeof raw !== "string" || raw.length > 500) continue;
    sheet[a] = raw;
    count++;
  }
  return sheet;
}

export interface SheetGrade {
  passed: boolean;
  message: string;
  checks: { label: string; passed: boolean }[];
}

/** Pure. Recalculates the candidate's workbook; each target must equal the expected value AND be a formula that references cells. */
export function gradeSpreadsheet(content: SpreadsheetContent, answerKey: Record<string, number>, submitted: Record<string, string>): SheetGrade {
  const layout = buildLayout(content);
  const sheet = mergeSubmission(layout, submitted);
  const values = evaluateSheet(sheet);

  const checks = layout.targets.map((target) => {
    const wrongCells = target.cells.filter((cell) => {
      const raw = sheet[cell] ?? "";
      const v: CellValue = values[cell] ?? null;
      if (!formulaReferencesCells(raw)) return true;
      if (isError(v) || typeof v !== "number") return true;
      const expected = answerKey[cell];
      const decimals = (content.tasks[target.task] as { decimals?: number }).decimals;
      // Lookups return a stored value verbatim, so they must match exactly.
      const abs = decimals === undefined ? 1e-9 : Math.pow(10, -decimals) + 1e-9;
      return !cellsEqual(v, expected, { abs });
    });
    const label = target.cells.length > 1 ? `${target.cells[0].replace(/\d+$/, "")}: ${target.cells.length - wrongCells.length}/${target.cells.length} rows correct` : `${target.cells[0]} correct`;
    return { label, passed: wrongCells.length === 0 };
  });
  const passed = checks.every((c) => c.passed);
  return {
    passed,
    message: passed ? "Every required cell calculates correctly." : "Some cells are wrong, empty, or typed-in numbers instead of formulas that reference the data.",
    checks,
  };
}
