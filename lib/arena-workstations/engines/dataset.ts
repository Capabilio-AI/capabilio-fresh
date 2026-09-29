import { z } from "zod";

export type Cell = string | number | null;
export type ColumnType = "number" | "text" | "date";

export interface Column {
  name: string;
  type: ColumnType;
  description?: string;
}

export interface Dataset {
  name: string;
  columns: Column[];
  rows: Cell[][];
}

export const IDENTIFIER = /^[a-z][a-z0-9_]{0,39}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const CellSchema = z.union([z.string().max(200), z.number().finite(), z.null()]);
export const ColumnSchema = z.object({
  name: z.string().regex(IDENTIFIER, "column names must be lower_snake_case"),
  type: z.enum(["number", "text", "date"]),
  description: z.string().max(200).optional(),
});
export const DatasetSchema = z.object({
  name: z.string().regex(IDENTIFIER, "table names must be lower_snake_case"),
  columns: z.array(ColumnSchema).min(1).max(12),
  rows: z.array(z.array(CellSchema)).min(1).max(120),
});

/**
 * Pure. Structural checks beyond the zod shape: row width, declared types
 * (unless `messy`, where values are allowed to violate the target type —
 * that's the point of a cleaning task), unique column names.
 */
export function datasetProblems(ds: Dataset, opts: { minRows: number; maxRows: number; messy?: boolean }): string[] {
  const problems: string[] = [];
  const names = ds.columns.map((c) => c.name);
  if (new Set(names).size !== names.length) problems.push(`${ds.name}: duplicate column names`);
  if (ds.rows.length < opts.minRows || ds.rows.length > opts.maxRows) problems.push(`${ds.name}: needs ${opts.minRows}-${opts.maxRows} rows, got ${ds.rows.length}`);
  ds.rows.forEach((row, i) => {
    if (row.length !== ds.columns.length) {
      problems.push(`${ds.name} row ${i + 1}: ${row.length} values for ${ds.columns.length} columns`);
      return;
    }
    if (opts.messy) return;
    row.forEach((v, j) => {
      if (v === null) return;
      const type = ds.columns[j].type;
      if (type === "number" && typeof v !== "number") problems.push(`${ds.name}.${ds.columns[j].name} row ${i + 1}: expected a number`);
      if (type === "date" && (typeof v !== "string" || !ISO_DATE.test(v))) problems.push(`${ds.name}.${ds.columns[j].name} row ${i + 1}: expected YYYY-MM-DD`);
      if (type === "text" && typeof v !== "string") problems.push(`${ds.name}.${ds.columns[j].name} row ${i + 1}: expected text`);
    });
  });
  return problems.slice(0, 12);
}

export function columnValues(ds: Dataset, column: string): Cell[] {
  const idx = ds.columns.findIndex((c) => c.name === column);
  if (idx === -1) throw new Error(`Unknown column ${column}`);
  return ds.rows.map((r) => r[idx]);
}

export function numericColumn(ds: Dataset, column: string): number[] {
  return columnValues(ds, column).filter((v): v is number => typeof v === "number");
}

/** Pure. Numbers within tolerance; text trimmed + case-insensitive unless `exactText`. */
export function cellsEqual(a: Cell, b: Cell, opts: { rel?: number; abs?: number; exactText?: boolean } = {}): boolean {
  if (a === null || b === null) return a === b;
  if (typeof a === "number" && typeof b === "number") return Math.abs(a - b) <= Math.max(opts.abs ?? 1e-9, Math.abs(b) * (opts.rel ?? 0));
  if (typeof a === "string" && typeof b === "string") return opts.exactText ? a === b : a.trim().toLowerCase() === b.trim().toLowerCase();
  return false;
}
