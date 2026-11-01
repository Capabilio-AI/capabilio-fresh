import { z } from "zod";
import { cellsEqual, columnValues, type Cell, type Dataset } from "./dataset";
import { evaluateSpec, type BiSpec } from "./bi";
import { address, columnLetters, evaluateSheet, formulaReferencesCells, isError, parseAddress, type CellValue, type Sheet } from "./formula";

// Spreadsheet tasks are a closed set. The server lays the workbook out,
// computes every expected value straight from the data (independently of
// the formula engine), and grades by recalculating the candidate's formulas.

export const SheetTaskSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("row_formula"), header: z.string().min(1).max(40), op: z.enum(["multiply", "divide", "add", "subtract", "percent_change", "percent_of"]), left: z.string(), right: z.string(), decimals: z.number().int().min(0).max(2) }),
  z.object({ type: z.literal("lookup"), header: z.string().min(1).max(40), key_column: z.string() }),
  z.object({ type: z.literal("summary"), label: z.string().min(1).max(60), fn: z.enum(["SUM", "AVERAGE", "MEDIAN", "STDEV", "MAX", "MIN", "COUNT"]), column: z.string(), decimals: z.number().int().min(0).max(2) }),
  z.object({ type: z.literal("conditional_summary"), label: z.string().min(1).max(60), fn: z.enum(["SUMIF", "COUNTIF", "AVERAGEIF"]), criteria_column: z.string(), criteria_value: z.string().max(60), column: z.string(), decimals: z.number().int().min(0).max(2) }),
  z.object({ type: z.literal("multi_conditional_summary"), label: z.string().min(1).max(60), fn: z.enum(["SUMIFS", "COUNTIFS", "AVERAGEIFS"]), criteria: z.array(z.object({ column: z.string(), value: z.string().max(60) })).min(2).max(3), column: z.string(), decimals: z.number().int().min(0).max(2) }),
  /** the analyst builds a PivotTable: one row field, one value field, a summary function. Graded on the table it produces, not on cells. */
  z.object({ type: z.literal("pivot"), label: z.string().min(1).max(60), row_column: z.string(), value_column: z.string().nullable(), fn: z.enum(["SUM", "AVERAGE", "COUNT"]) }),
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
  /** a PivotTable task has no cells: it is built in the PivotTable panel and graded on the table it produces */
  pivot?: boolean;
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
const FN_TEXT: Record<string, string> = { SUM: "total", AVERAGE: "average", MEDIAN: "median", STDEV: "sample standard deviation", SUMIFS: "total", COUNTIFS: "number of rows", AVERAGEIFS: "average", MAX: "maximum", MIN: "minimum", COUNT: "count of values", SUMIF: "total", COUNTIF: "number of rows", AVERAGEIF: "average" };

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

  const summaryTasks = tasks.map((t, i) => ({ t, i })).filter(({ t }) => t.type === "summary" || t.type === "conditional_summary" || t.type === "multi_conditional_summary");
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
    if (t.type === "pivot") {
      const what = t.value_column === null ? "the number of rows" : `the ${FN_TEXT[t.fn]} of ${ref(t.value_column)}`;
      return { task: i, cells: [], pivot: true, instruction: `PivotTable (“${t.label}”): insert a PivotTable with ${ref(t.row_column)} as the rows and ${what} as the values.` };
    }
    const k = summaryTasks.findIndex((s) => s.i === i);
    const cell = address(1, summaryRow + k);
    const decimalsText = `, rounded to ${(t as { decimals: number }).decimals} decimal${(t as { decimals: number }).decimals === 1 ? "" : "s"}`;
    const instruction =
      t.type === "multi_conditional_summary"
        ? `${cell} (“${t.label}”): the ${FN_TEXT[t.fn]}${t.fn === "COUNTIFS" ? "" : ` of ${ref(t.column)}`} for rows where ${t.criteria.map((c) => `${ref(c.column)} is “${c.value}”`).join(" and ")}${t.fn === "COUNTIFS" ? "" : decimalsText}.`
      : t.type === "summary"
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
    if (t.type === "pivot") {
      if (pivotSeries(data, { rows: t.row_column, values: t.value_column, fn: t.fn }).length < 2) throw new Error("a PivotTable task needs at least two groups");
    } else if (t.type === "multi_conditional_summary") {
      const crit = t.criteria.map((c) => ({ col: columnValues(data, c.column), value: c.value.trim().toLowerCase() }));
      const vals = t.fn === "COUNTIFS" ? [] : columnValues(data, t.column).map(num);
      const picked: number[] = [];
      let count = 0;
      for (let r = 0; r < data.rows.length; r++) {
        if (!crit.every((c) => String(c.col[r]).trim().toLowerCase() === c.value)) continue;
        count++;
        if (vals[r] !== null && vals[r] !== undefined) picked.push(vals[r] as number);
      }
      if (count === 0) throw new Error("no rows match all the criteria");
      const total = picked.reduce((s, x) => s + x, 0);
      out[target.cells[0]] = t.fn === "COUNTIFS" ? count : round(t.fn === "SUMIFS" ? total : total / picked.length, t.decimals);
    } else if (t.type === "row_formula") {
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
      const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
      const sorted = [...xs].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
      if (t.fn === "STDEV" && xs.length < 2) throw new Error("a standard deviation needs at least two numbers");
      const v = t.fn === "SUM" ? xs.reduce((s, x) => s + x, 0) : t.fn === "AVERAGE" ? mean : t.fn === "MEDIAN" ? median : t.fn === "STDEV" ? Math.sqrt(xs.reduce((s, x) => s + (x - mean) ** 2, 0) / (xs.length - 1)) : t.fn === "MAX" ? Math.max(...xs) : t.fn === "MIN" ? Math.min(...xs) : xs.length;
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

export interface PivotConfig {
  rows: string;
  values: string | null;
  fn: "SUM" | "AVERAGE" | "COUNT";
}

/** Pure. The table a PivotTable with this setup shows: one line per row-field value, sorted A to Z. Shares the dashboard engine so a pivot and a chart can never disagree. */
export function pivotSeries(data: Dataset, p: PivotConfig) {
  const spec: BiSpec = { chart_type: "table", dimension: p.rows, dimension_grain: "value", measure: p.fn === "COUNT" ? null : p.values, aggregation: p.fn.toLowerCase() as BiSpec["aggregation"], quick: "none", measure2: null, dax: null, filters: [], sort: "dimension_asc", limit: null };
  return evaluateSpec(data, spec);
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
export function gradeSpreadsheet(content: SpreadsheetContent, answerKey: Record<string, number>, submitted: Record<string, string>, pivots: Record<string, PivotConfig> = {}): SheetGrade {
  const layout = buildLayout(content);
  const sheet = mergeSubmission(layout, submitted);
  const values = evaluateSheet(sheet);

  const checks = layout.targets.map((target) => {
    if (target.pivot) {
      const t = content.tasks[target.task] as Extract<SheetTask, { type: "pivot" }>;
      const given = pivots[String(target.task)];
      let ok = false;
      try {
        if (given) {
          const want = pivotSeries(content.data, { rows: t.row_column, values: t.value_column, fn: t.fn });
          const got = pivotSeries(content.data, given);
          ok = got.length === want.length && want.every((p, i) => got[i].label.toLowerCase() === p.label.toLowerCase() && Math.abs(got[i].value - p.value) <= Math.max(0.01, Math.abs(p.value) * 0.001));
        }
      } catch {
        ok = false;
      }
      return { label: `PivotTable “${t.label}” shows the right table`, passed: ok };
    }
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
