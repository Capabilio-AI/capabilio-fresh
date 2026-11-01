export interface Bin {
  label: string;
  from: number;
  to: number;
  count: number;
}

/** Equal-width bins (Sturges' rule unless told). The last bin includes its upper edge, so every value lands in exactly one bin. Pure. */
export function histogram(values: number[], bins?: number): Bin[] {
  const xs = values.filter((v) => Number.isFinite(v));
  if (xs.length === 0) return [];
  const lo = Math.min(...xs);
  const hi = Math.max(...xs);
  if (lo === hi) return [{ label: String(lo), from: lo, to: hi, count: xs.length }];
  const k = Math.max(2, Math.min(20, bins ?? Math.ceil(Math.log2(xs.length)) + 1));
  const width = (hi - lo) / k;
  const out: Bin[] = Array.from({ length: k }, (_, i) => ({ from: lo + i * width, to: lo + (i + 1) * width, count: 0, label: "" }));
  for (const v of xs) out[Math.min(k - 1, Math.floor((v - lo) / width))].count++;
  const fmt = (n: number) => (Math.abs(n) >= 100 ? Math.round(n).toLocaleString("en-IN") : String(Math.round(n * 100) / 100));
  return out.map((b) => ({ ...b, label: `${fmt(b.from)}–${fmt(b.to)}` }));
}

export interface VariableSummary {
  n: number;
  missing: number;
  min: number | null;
  max: number | null;
}

/** What a variable view shows before any statistic is computed: how many values, how many gaps, the range. Deliberately no mean or spread. */
export function summarise(values: (number | string | null)[]): VariableSummary {
  const nums = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  return { n: values.length - values.filter((v) => v === null || v === "").length, missing: values.filter((v) => v === null || v === "").length, min: nums.length ? Math.min(...nums) : null, max: nums.length ? Math.max(...nums) : null };
}
