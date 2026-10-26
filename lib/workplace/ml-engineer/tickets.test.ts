import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { mlTool } from "@/lib/arena-workstations/tools/ml";
import { AI_ML_ENGINEER } from "@/lib/arena-roles/blueprints/ai-ml-engineer";
import { TOOLKIT as AI_ML_ENGINEER_TOOLKIT } from "@/lib/arena-roles/toolkit/ai-ml-engineer";
import { validateBlueprint } from "@/lib/arena-roles/blueprint";
import { validateToolkit } from "@/lib/arena-roles/toolkit/types";
import { templateTiers } from "../tickets/pick";
import { hashSeed, makeRng } from "../rng";
import { score, sigmoid } from "../ml/metrics";
import { ML_TEMPLATES, type MlDraft } from "../ml/tickets";
import { ML_ENGINEER_AREAS, ML_ENGINEER_TEMPLATES } from "./tickets";

type NumbersKey = Extract<MlDraft["key"], { kind: "numbers" }>;
type PredictKey = Extract<MlDraft["key"], { kind: "predict" }>;

const ALL = [...ML_TEMPLATES, ...ML_ENGINEER_TEMPLATES];
const SEEDS = 5;
const build = (id: string, i: number) => ALL.find((x) => x.id === id)!.build(makeRng(hashSeed("mle-test", id, i)));
const table = (d: MlDraft, name: string) => {
  const [head, ...lines] = d.content.files.find((f) => f.name === name)!.text.split("\n");
  const cols = head.split(",");
  return lines.map((l) => Object.fromEntries(l.split(",").map((v, i) => [cols[i], v])));
};
const r3 = (v: number) => Math.round(v * 1000) / 1000;
const num = (s: string) => Number(s);
const grade = (d: MlDraft, sub: Parameters<typeof mlTool.grade>[2]) => mlTool.grade(d.content as never, d.key as never, sub);

/** Area keys the migrations give ai-ml-engineer, read from the SQL so the blueprint cannot drift from them. */
function migrationAreas(): string[] {
  const sql = ["108_ai_ml_role.sql", "135_ai_ml_engineer_areas.sql"].map((f) => readFileSync(join(process.cwd(), "supabase/migrations", f), "utf8")).join("\n");
  return [...sql.matchAll(/\('ai-ml-engineer', '([a-z-]+)', '[^']+', '[^']+', 'ml_workspace', true/g)].map((m) => m[1]);
}

// ---- independent solutions: each reads only what the learner is given ----
const recallOf = (rows: Record<string, string>[], a: string, p: string) => {
  const pos = rows.filter((r) => r[a] === "1");
  return pos.filter((r) => r[p] === "1").length / pos.length;
};
const SOLVERS: Record<string, (d: MlDraft) => Record<string, number>> = {
  "mle-contract-validation": (d) => {
    const rows = table(d, "requests.csv");
    const missing = rows.filter((r) => r.tenure_months === "" || r.monthly_spend === "" || r.plan === "");
    const filled = rows.filter((r) => !missing.includes(r));
    const range = filled.filter((r) => num(r.tenure_months) < 1 || num(r.tenure_months) > 60 || num(r.monthly_spend) < 150 || num(r.monthly_spend) > 900);
    const bad = filled.filter((r) => !["basic", "plus", "pro"].includes(r.plan));
    const invalid = filled.filter((r) => range.includes(r) || bad.includes(r)).length + missing.length;
    return { invalid, missing: missing.length, out_of_range: range.length, bad_category: bad.length };
  },
  "mle-model-budget": (d) => {
    const [lat, size] = [/LATENCY_LIMIT_MS = (\d+)/, /SIZE_LIMIT_MB = (\d+)/].map((re) => num(d.content.starter.match(re)![1]));
    const rows = table(d, "candidates.csv").sort((a, b) => num(b.val_accuracy) - num(a.val_accuracy));
    const fits = rows.filter((r) => num(r.p95_latency_ms) <= lat && num(r.size_mb) <= size);
    return { model_id: num(fits[0].model_id), accuracy: num(fits[0].val_accuracy), given_up: r3(num(rows[0].val_accuracy) - num(fits[0].val_accuracy)), fit_count: fits.length };
  },
  "mle-shadow-promotion": (d) => {
    const rows = table(d, "shadow_log.csv");
    const flagged = rows.filter((r) => r.v2_shadow === "1");
    const [v1, v2, p2] = [r3(recallOf(rows, "actual", "v1_live")), r3(recallOf(rows, "actual", "v2_shadow")), r3(flagged.filter((r) => r.actual === "1").length / flagged.length)];
    const floor = num(d.scenario.match(/at least (\d+\.\d+)/)![1]);
    return { v1_recall: v1, v2_recall: v2, v2_precision: p2, disagree: r3(rows.filter((r) => r.v1_live !== r.v2_shadow).length / rows.length), promote: v2 > v1 && p2 >= floor ? 1 : 0 };
  },
  "mle-store-slices": (d) => {
    const rows = table(d, "results.csv");
    const acc = (rs: typeof rows) => rs.filter((r) => r.actual === r.predicted).length / rs.length;
    const stores = [...new Set(rows.map((r) => r.store_code))].map((s) => ({ s, a: acc(rows.filter((r) => r.store_code === s)) })).sort((a, b) => a.a - b.a);
    return { overall: r3(acc(rows)), worst_store: num(stores[0].s), worst_accuracy: r3(stores[0].a), best_accuracy: r3(stores[stores.length - 1].a) };
  },
  "mle-region-misses": (d) => {
    const rows = table(d, "results.csv");
    const misses = rows.filter((r) => r.actual === "1" && r.predicted === "0");
    const pos = rows.filter((r) => r.actual === "1").length;
    const [region, fn] = [...new Set(misses.map((r) => r.region_code))].map((k) => [k, misses.filter((r) => r.region_code === k).length] as const).sort((a, b) => b[1] - a[1])[0];
    return { recall: r3(recallOf(rows, "actual", "predicted")), region: num(region), region_fn: fn, share: r3(fn / misses.length), recall_if_fixed: r3((pos - misses.length + fn) / pos) };
  },
  "mle-depth-sweep": (d) => {
    const rows = table(d, "depth_sweep.csv").map((r) => ({ d: num(r.max_depth), t: num(r.train_accuracy), v: num(r.validation_accuracy) }));
    const best = [...rows].sort((a, b) => b.v - a.v)[0];
    return { best_depth: best.d, best_val: best.v, gap_deepest: r3(rows[rows.length - 1].t - rows[rows.length - 1].v), first_overfit: rows.find((r) => r3(r.t - r.v) > 0.1)!.d };
  },
  "mle-class-weights": (d) => {
    const y = table(d, "labels.csv").map((r) => num(r.label));
    const pos = y.filter((v) => v === 1).length;
    return { positive_share: r3(pos / y.length), baseline: r3((y.length - pos) / y.length), weight_pos: r3(y.length / (2 * pos)), weight_neg: r3(y.length / (2 * (y.length - pos))) };
  },
  "mle-train-test-overlap": (d) => {
    const train = new Set(table(d, "train.csv").map((r) => r.customer_id));
    const test = table(d, "test.csv").map((r) => r.customer_id);
    const overlap = test.filter((id) => train.has(id)).length;
    const distinct = new Set(test);
    return { overlap_rows: overlap, contaminated_share: r3(overlap / test.length), distinct_test: distinct.size, clean_customers: [...distinct].filter((id) => !train.has(id)).length };
  },
};

/** A plain logistic regression on the CSV the learner sees, ignoring (or trusting) the leaked column. */
function fitAndPredict(d: MlDraft, useLeak: boolean): number[] {
  const train = table(d, "train.csv");
  const test = table(d, "test.csv");
  const spends = train.map((r) => r.monthly_spend).filter((v) => v !== "").map(Number).sort((a, b) => a - b);
  const mid = spends[Math.floor(spends.length / 2)];
  const feat = (r: Record<string, string>) => [num(r.tenure_months || "30") / 30, ((r.monthly_spend === "" ? mid : num(r.monthly_spend)) - 300) / 150, num(r.support_tickets || "0") / 3, num(r.late_payments || "0"), r.plan === "basic" ? 1 : 0, r.plan === "pro" ? 1 : 0, useLeak ? num(r.refund_issued || "0") : 0];
  const X = train.map(feat);
  const y = train.map((r) => num(r.left));
  const w = new Array(X[0].length + 1).fill(0);
  const p = (x: number[]) => sigmoid(w[0] + x.reduce((s, v, j) => s + v * w[j + 1], 0));
  for (let it = 0; it < 800; it++) {
    const g = new Array(w.length).fill(0);
    X.forEach((x, i) => {
      const e = p(x) - y[i];
      g[0] += e;
      x.forEach((v, j) => (g[j + 1] += e * v));
    });
    g.forEach((v, j) => (w[j] -= (0.5 * v) / X.length));
  }
  return test.map((r) => (p(feat(r)) >= 0.5 ? 1 : 0));
}

describe("AI/ML Engineer templates", () => {
  it("keep each fixed title in step with the ticket, rebuild identically from a seed, and never repeat a title", () => {
    for (const x of ML_ENGINEER_TEMPLATES) {
      expect(x.build(makeRng(3)).title).toBe(x.title);
      expect(JSON.stringify(x.build(makeRng(7)))).toBe(JSON.stringify(x.build(makeRng(7))));
    }
    expect(new Set(ALL.map((x) => x.title.toLowerCase())).size).toBe(ALL.length);
    expect(new Set(ALL.map((x) => x.id)).size).toBe(ALL.length);
  }, 60_000);

  it("give every enabled area of the role an easy ticket a fresher is served first, and at least 8 templates in all", () => {
    const enabled = AI_ML_ENGINEER.areas.filter((a) => a.status === "enabled").map((a) => a.areaKey);
    expect(ALL.filter((x) => x.areas.some((a) => enabled.includes(a))).length).toBeGreaterThanOrEqual(8);
    for (const areaKey of enabled) {
      const [first] = templateTiers(ALL, { difficulty: "easy", level: "fresher", areaKey });
      expect(first?.length, areaKey).toBeGreaterThan(0);
      for (const x of first) {
        expect([x.difficulty, x.minLevel], x.id).toEqual(["easy", "fresher"]);
        for (let i = 0; i < SEEDS; i++) expect(build(x.id, i).content.kind, x.id).toMatch(/predict|numbers/);
      }
    }
  }, 120_000);

  for (const [id, solve] of Object.entries(SOLVERS)) {
    it(`${id}: the reference solution passes on every seed; blank and zero answers fail`, async () => {
      for (let i = 0; i < SEEDS; i++) {
        const d = build(id, i);
        const key = d.key as NumbersKey;
        expect(Object.keys(key.expected).sort()).toEqual(d.content.fields.map((f) => f.key).sort());
        const answers = Object.fromEntries(Object.entries(solve(d)).map(([k, v]) => [k, String(v)]));
        const result = await grade(d, { answers });
        expect(result.passed, `${id} seed ${i}: ${JSON.stringify(result.checks)}`).toBe(true);
        expect((await grade(d, { answers: {} })).passed).toBe(false);
        expect((await grade(d, { answers: Object.fromEntries(d.content.fields.map((f) => [f.key, "0"])) })).passed).toBe(false);
      }
    });
  }

  it("mle-leakage-easy: an honest model passes, the one trusting the leaked column fails", async () => {
    let honest = 0;
    let leaky = 0;
    for (let i = 0; i < SEEDS; i++) {
      const d = build("mle-leakage-easy", i);
      const key = d.key as PredictKey;
      if (score(key.metric, key.yTest, fitAndPredict(d, false)) >= key.threshold) honest++;
      if ((await grade(d, { predictions: fitAndPredict(d, true) })).passed) leaky++;
    }
    expect(honest).toBeGreaterThanOrEqual(SEEDS - 1);
    expect(leaky).toBe(0);
  }, 60_000);

  it("reused builders for evaluation and fundamentals grade their exact answers and reject blanks", async () => {
    for (const id of ["mle-eval-confusion", "mle-zscores"]) {
      const d = build(id, 0);
      const exact = Object.fromEntries(Object.entries((d.key as NumbersKey).expected).map(([k, v]) => [k, String(v)]));
      expect((await grade(d, { answers: exact })).passed).toBe(true);
      expect((await grade(d, { answers: {} })).passed).toBe(false);
    }
  });
});

describe("AI/ML Engineer blueprint and toolkit", () => {
  it("are well-formed", () => {
    expect(validateBlueprint(AI_ML_ENGINEER)).toEqual([]);
    expect(validateToolkit(AI_ML_ENGINEER_TOOLKIT)).toEqual([]);
  });

  it("mirror exactly the areas the migrations enable, at the ml tool's versions", () => {
    expect(AI_ML_ENGINEER.areas.filter((a) => a.status === "enabled").map((a) => a.areaKey).sort()).toEqual(migrationAreas().sort());
    expect(migrationAreas()).toEqual(expect.arrayContaining([...ML_ENGINEER_AREAS]));
    for (const a of AI_ML_ENGINEER.areas) expect([a.toolType, a.generationVersion, a.gradingVersion]).toEqual(["ml_workspace", mlTool.generationVersion, mlTool.gradingVersion]);
  });
});
