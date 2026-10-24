import type { Objective, Reading } from "./types";

export const round = (n: number, d = 2): number => Math.round(n * 10 ** d) / 10 ** d;
/** a readable number: no trailing zeros, thousands grouped */
export const fmt = (n: number, d = 2): string => {
  if (!Number.isFinite(n)) return "n/a";
  return round(n, d).toLocaleString("en-IN", { maximumFractionDigits: d });
};
export const rupees = (n: number): string => `₹${Math.round(n).toLocaleString("en-IN")}`;

export function objective(id: string, label: string, ok: boolean, detail: string, nudge: string): Objective {
  return { id, label, ok, detail, nudge };
}

/** A reading with a gauge: ok when value sits inside low..high. */
export function gauge(id: string, label: string, value: number, display: string, range: { min: number; max: number; low?: number; high?: number }): Reading {
  const ok = (range.low === undefined || value >= range.low) && (range.high === undefined || value <= range.high);
  return { id, label, display, ok, bar: { value, ...range } };
}
export const info = (id: string, label: string, display: string): Reading => ({ id, label, display, ok: null });

export const range = (from: number, to: number, count: number): number[] => Array.from({ length: count }, (_, i) => from + ((to - from) * i) / (count - 1));
export const choices = (values: readonly (string | number)[], label: (v: string) => string = (v) => v) => values.map((v) => ({ value: String(v), label: label(String(v)) }));
