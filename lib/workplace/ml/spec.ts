import { z } from "zod";
import type { Rng } from "../rng";
import { sigmoid } from "./metrics";

const NAME = /^[a-z][a-z0-9_]{1,30}$/;
const effect = z.number().min(-3).max(3);
const missing = z.number().min(0).max(0.2).default(0);

const NumericFeature = z.object({
  name: z.string().regex(NAME),
  kind: z.enum(["int", "float"]),
  min: z.number().min(-1e6).max(1e6),
  max: z.number().min(-1e6).max(1e6),
  /** "right" makes small values common and large values rare, like spend or response time */
  skew: z.enum(["none", "right"]).default("none"),
  /** change in the log-odds from the lowest to the highest value */
  effect,
  /** an extra jump once the value reaches `step_at` (for example 4 or more support tickets) */
  step_at: z.number().optional(),
  step_effect: effect.optional(),
  missing,
});
const CategoryFeature = z.object({
  name: z.string().regex(NAME),
  kind: z.literal("category"),
  categories: z.array(z.object({ value: z.string().regex(/^[a-z][a-z0-9_ ]{0,20}$/), weight: z.number().min(1).max(100), effect })).min(2).max(6),
  missing,
});

/** A made-up but realistic prediction problem. The AI writes this; code turns it into data, so no AI-written code ever runs. */
export const DatasetSpecSchema = z
  .object({
    entity: z.string().regex(/^[a-z][a-z ]{2,24}$/),
    id_column: z.string().regex(NAME),
    target: z.object({ name: z.string().regex(NAME), positive_meaning: z.string().min(4).max(80), prevalence: z.number().min(0.05).max(0.5) }),
    features: z.array(z.union([NumericFeature, CategoryFeature])).min(4).max(8),
    /** a column recorded only after the outcome is known (used for the leakage task) */
    leak: z.object({ name: z.string().regex(NAME), description: z.string().min(10).max(160) }).optional(),
  })
  .superRefine((spec, ctx) => {
    const names = [spec.id_column, spec.target.name, ...spec.features.map((f) => f.name), ...(spec.leak ? [spec.leak.name] : [])];
    if (new Set(names).size !== names.length) ctx.addIssue({ code: "custom", message: "column names must all be different" });
    if (spec.features.filter((f) => f.kind !== "category").length < 2) ctx.addIssue({ code: "custom", message: "need at least two numeric features" });
    if (!spec.features.some((f) => f.kind === "category")) ctx.addIssue({ code: "custom", message: "need at least one category feature" });
    for (const f of spec.features) if (f.kind !== "category" && !(f.max > f.min)) ctx.addIssue({ code: "custom", message: `${f.name}: max must be greater than min` });
  });
export type DatasetSpec = z.infer<typeof DatasetSpecSchema>;
export type FeatureSpec = DatasetSpec["features"][number];
export type NumericSpec = Extract<FeatureSpec, { kind: "int" | "float" }>;
export type CategorySpec = Extract<FeatureSpec, { kind: "category" }>;
export const isNumeric = (f: FeatureSpec): f is NumericSpec => f.kind !== "category";

export type Value = number | string | null;
export interface Row {
  id: number;
  values: Record<string, Value>;
  /** true chance of the positive outcome, known only to the generator */
  p: number;
  y: number;
}

const normal = (rng: Rng) => Math.sqrt(-2 * Math.log(1 - rng.next())) * Math.cos(2 * Math.PI * rng.next());

function sampleNumeric(f: NumericSpec, rng: Rng): number {
  const u = f.skew === "right" ? rng.next() ** 2 : rng.next();
  const raw = f.min + (f.max - f.min) * u;
  return f.kind === "int" ? Math.round(raw) : Math.round(raw * 100) / 100;
}

function logit(spec: DatasetSpec, values: Record<string, Value>): number {
  let z = 0;
  for (const f of spec.features) {
    const v = values[f.name];
    if (f.kind === "category") z += f.categories.find((c) => c.value === v)?.effect ?? 0;
    else {
      const n = v as number;
      z += f.effect * ((n - f.min) / (f.max - f.min) - 0.5);
      if (f.step_at !== undefined && n >= f.step_at) z += f.step_effect ?? 0;
    }
  }
  return z;
}

/** Rows whose chance of the positive outcome averages the target prevalence; each label is drawn from that chance. */
export function makeRows(spec: DatasetSpec, rng: Rng, count: number, firstId = 1): Row[] {
  const raw = Array.from({ length: count }, (_, i) => {
    const values: Record<string, Value> = {};
    for (const f of spec.features) values[f.name] = f.kind === "category" ? rng.weighted(f.categories.map((c) => [c.value, c.weight] as const)) : sampleNumeric(f, rng);
    return { id: firstId + i, values, z: logit(spec, values) + 0.35 * normal(rng) };
  });
  let lo = -14;
  let hi = 14;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const mean = raw.reduce((s, r) => s + sigmoid(r.z + mid), 0) / raw.length;
    if (mean < spec.target.prevalence) lo = mid;
    else hi = mid;
  }
  const shift = (lo + hi) / 2;
  return raw.map(({ id, values, z }) => {
    const p = sigmoid(z + shift);
    return { id, values, p, y: rng.chance(p) ? 1 : 0 };
  });
}

/** The made-up subscription business the first version of this role used; also the fallback when the AI cannot produce a valid scenario. */
export const CHURN_SPEC: DatasetSpec = DatasetSpecSchema.parse({
  entity: "customer",
  id_column: "customer_id",
  target: { name: "left", positive_meaning: "the customer left", prevalence: 0.3 },
  features: [
    { name: "tenure_months", kind: "int", min: 1, max: 60, effect: -2.1 },
    { name: "monthly_spend", kind: "float", min: 150, max: 900, skew: "right", effect: 0.9, missing: 0.08 },
    { name: "support_tickets", kind: "int", min: 0, max: 7, effect: 0.8, step_at: 4, step_effect: 0.85 },
    { name: "late_payments", kind: "int", min: 0, max: 4, effect: 2.2 },
    { name: "plan", kind: "category", categories: [{ value: "basic", weight: 50, effect: 0.5 }, { value: "plus", weight: 33, effect: 0 }, { value: "pro", weight: 17, effect: -0.4 }] },
    { name: "city", kind: "category", categories: ["pune", "mysuru", "kochi", "indore"].map((value) => ({ value, weight: 25, effect: 0 })) },
  ],
  leak: { name: "refund_issued", description: "a refund recorded after the customer already left" },
});
