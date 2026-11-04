import { z } from "zod";

/**
 * Practice data for a guided project. The AI describes the tables (columns, ranges, relations); this code builds the rows with a seeded
 * generator, so the file is the same every time a student opens it, nothing is stored, and no made-up link or "real" figure is ever claimed.
 */

const num = z.number().finite();
export const ColumnSpec = z
  .object({
    name: z.string().regex(/^[A-Za-z][A-Za-z0-9_ ]{0,39}$/),
    type: z.enum(["id", "integer", "number", "category", "date", "boolean"]),
    description: z.string().max(160).default(""),
    min: num.optional(),
    max: num.optional(),
    /** for category */
    choices: z.array(z.string().max(40)).min(1).max(12).optional(),
    /** for date: ISO start and end */
    from_date: z.string().optional(),
    to_date: z.string().optional(),
    /** numeric column that follows an earlier numeric column: value = other * factor + offset + noise */
    from: z.string().optional(),
    factor: num.optional(),
    offset: num.optional(),
    noise: num.optional(),
    /** category whose values are the ids of an earlier table: "customers.customer_id" */
    ref: z.string().optional(),
    /** share of cells left empty, 0 to 0.2: gives "handle missing values" projects something to handle */
    missingRate: z.number().min(0).max(0.2).optional(),
  })
  .strict();
export type ColumnSpec = z.infer<typeof ColumnSpec>;

export const DatasetSpec = z
  .object({
    name: z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,39}$/),
    description: z.string().max(260),
    rows: z.number().int().min(10).max(500),
    columns: z.array(ColumnSpec).min(2).max(12),
  })
  .strict();
export type DatasetSpec = z.infer<typeof DatasetSpec>;

export interface Table { name: string; header: string[]; rows: (string | number)[][] }

/** Small, fast, seedable generator (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A stable 32-bit seed from text (the project's id), so a project always yields the same data. */
export function seedOf(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

const gauss = (r: () => number) => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
const round = (n: number, dp: number) => Math.round(n * 10 ** dp) / 10 ** dp;
const DAY = 86_400_000;

function cell(c: ColumnSpec, i: number, row: (string | number)[], header: string[], r: () => number, refs: Map<string, (string | number)[]>): string | number {
  const lo = c.min ?? 0;
  const hi = c.max ?? lo + 100;
  switch (c.type) {
    case "id": return i + 1;
    case "boolean": return r() < 0.5 ? "yes" : "no";
    case "category": {
      const pool = c.ref ? refs.get(c.ref) : c.choices;
      return pool && pool.length ? pool[Math.floor(r() * pool.length)] : "";
    }
    case "date": {
      const a = Date.parse(c.from_date ?? "2025-01-01");
      const b = Date.parse(c.to_date ?? "2025-12-31");
      const start = Number.isNaN(a) ? Date.parse("2025-01-01") : a;
      const end = Number.isNaN(b) || b < start ? start + 365 * DAY : b;
      return new Date(start + Math.floor(r() * ((end - start) / DAY + 1)) * DAY).toISOString().slice(0, 10);
    }
    default: {
      const dp = c.type === "integer" ? 0 : 2;
      const base = c.from ? Number(row[header.indexOf(c.from)]) : Number.NaN;
      let v = Number.isNaN(base) ? lo + r() * (hi - lo) : base * (c.factor ?? 1) + (c.offset ?? 0) + gauss(r) * (c.noise ?? 0);
      if (c.min !== undefined) v = Math.max(c.min, v);
      if (c.max !== undefined) v = Math.min(c.max, v);
      return round(v, dp);
    }
  }
}

/** Builds every table in order, so a later table can reference ids of an earlier one. */
export function generateTables(specs: DatasetSpec[], seed: number): Table[] {
  const r = rng(seed);
  const refs = new Map<string, (string | number)[]>();
  return specs.map((spec) => {
    const header = spec.columns.map((c) => c.name);
    const rows: (string | number)[][] = [];
    for (let i = 0; i < spec.rows; i++) {
      const row: (string | number)[] = [];
      spec.columns.forEach((c) => {
        const value = cell(c, i, row, header, r, refs);
        row.push(c.missingRate && r() < c.missingRate && c.type !== "id" ? "" : value);
      });
      rows.push(row);
    }
    spec.columns.forEach((c, ci) => refs.set(`${spec.name}.${c.name}`, rows.map((row) => row[ci])));
    return { name: spec.name, header, rows };
  });
}

const esc = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export const toCsv = (t: Table): string => [t.header, ...t.rows].map((row) => row.map(esc).join(",")).join("\n") + "\n";
