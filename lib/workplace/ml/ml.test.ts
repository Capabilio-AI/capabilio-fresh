import { describe, expect, it } from "vitest";
import { hashSeed, makeRng } from "../rng";
import { score, sigmoid } from "./metrics";
import { ML_TEMPLATES, type MlDraft } from "./tickets";

const parse = (text: string) => {
  const [head, ...lines] = text.split("\n");
  const cols = head.split(",");
  return { cols, rows: lines.map((l) => l.split(",")) };
};

/** A plain logistic regression, standing in for a sensible learner's model. */
function fitAndPredict(draft: MlDraft, useLeak: boolean): number[] {
  const train = parse(draft.content.files.find((f) => f.name === "train.csv")!.text);
  const test = parse(draft.content.files.find((f) => f.name === "test.csv")!.text);
  const idx = (cols: string[], n: string) => cols.indexOf(n);
  const spends = train.rows.map((r) => r[idx(train.cols, "monthly_spend")]).filter((v) => v !== "").map(Number).sort((a, b) => a - b);
  const medianSpend = spends[Math.floor(spends.length / 2)];
  const feat = (cols: string[], r: string[]) => {
    const g = (n: string) => r[idx(cols, n)];
    const spend = g("monthly_spend") === "" ? medianSpend : Number(g("monthly_spend"));
    const leak = useLeak && cols.includes("refund_issued") ? (g("refund_issued") === "" ? 0 : Number(g("refund_issued"))) : 0;
    return [Number(g("tenure_months")) / 30, (spend - 300) / 150, Number(g("support_tickets")) / 3, Number(g("late_payments")), g("plan") === "basic" ? 1 : 0, g("plan") === "pro" ? 1 : 0, leak];
  };
  const X = train.rows.map((r) => feat(train.cols, r));
  const y = train.rows.map((r) => Number(r[idx(train.cols, "left")]));
  const w = new Array(X[0].length + 1).fill(0);
  for (let it = 0; it < 800; it++) {
    const grad = new Array(w.length).fill(0);
    X.forEach((x, i) => {
      const e = sigmoid(w[0] + x.reduce((s, v, j) => s + v * w[j + 1], 0)) - y[i];
      grad[0] += e;
      x.forEach((v, j) => (grad[j + 1] += e * v));
    });
    grad.forEach((g, j) => (w[j] -= (0.5 * g) / X.length));
  }
  const p = (x: number[]) => sigmoid(w[0] + x.reduce((s, v, j) => s + v * w[j + 1], 0));
  const trainP = X.map(p);
  let bestT = 0.5;
  let best = -1;
  for (let t = 0.05; t < 0.8; t += 0.025) {
    const s = score("f1", y, trainP.map((v) => (v >= t ? 1 : 0)));
    if (s > best) { best = s; bestT = t; }
  }
  const t = draft.content.metric === "f1" ? bestT : 0.5;
  return test.rows.map((r) => (p(feat(test.cols, r)) >= t ? 1 : 0));
}

const SEEDS = 6;
const build = (id: string, i: number) => ML_TEMPLATES.find((t) => t.id === id)!.build(makeRng(hashSeed("ml-test", id, i)));

describe("ML tickets", () => {
  it("keeps each template's fixed title in step with the ticket it builds", () => {
    for (const t of ML_TEMPLATES) expect(t.build(makeRng(3)).title).toBe(t.title);
  }, 60_000);

  it("rebuild identically from the same seed", () => {
    for (const t of ML_TEMPLATES) expect(JSON.stringify(t.build(makeRng(7)))).toBe(JSON.stringify(t.build(makeRng(7))));
  });

  for (const id of ["ml-churn-accuracy", "ml-churn-imbalanced", "ml-churn-hard"]) {
    it(`${id}: a sensible model reaches the target for most users, doing nothing never does`, () => {
      let reached = 0;
      for (let i = 0; i < SEEDS; i++) {
        const d = build(id, i);
        const key = d.key as Extract<MlDraft["key"], { kind: "predict" }>;
        expect(d.content.files.find((f) => f.name === "test.csv")!.text.split("\n").length - 1).toBe(d.content.expectedPredictions);
        expect(key.threshold).toBeGreaterThan(key.baseline);
        const majority = key.metric === "f1" ? key.yTest.map(() => 1) : key.yTest.map(() => (key.yTest.filter((v) => v === 1).length * 2 > key.yTest.length ? 1 : 0));
        expect(score(key.metric, key.yTest, majority)).toBeLessThan(key.threshold);
        if (score(key.metric, key.yTest, fitAndPredict(d, false)) >= key.threshold) reached++;
      }
      expect(reached).toBeGreaterThanOrEqual(SEEDS - 1);
    });
  }

  it("the leakage ticket punishes a model that uses the leaked column", () => {
    let leakyFails = 0;
    let honestPasses = 0;
    for (let i = 0; i < SEEDS; i++) {
      const d = build("ml-leakage-refund", i);
      const key = d.key as Extract<MlDraft["key"], { kind: "predict" }>;
      if (score("f1", key.yTest, fitAndPredict(d, true)) < key.threshold) leakyFails++;
      if (score("f1", key.yTest, fitAndPredict(d, false)) >= key.threshold) honestPasses++;
    }
    expect(leakyFails).toBeGreaterThanOrEqual(SEEDS - 1);
    expect(honestPasses).toBeGreaterThanOrEqual(SEEDS - 1);
  });

  it("numeric tickets give one expected value per field", () => {
    for (const id of ["ml-prep-clean", "ml-eval-imbalance", "ml-fundamentals-gradient"]) {
      const d = build(id, 0);
      const key = d.key as Extract<MlDraft["key"], { kind: "numbers" }>;
      expect(Object.keys(key.expected).sort()).toEqual(d.content.fields.map((f) => f.key).sort());
      for (const f of d.content.fields) expect(Number.isFinite(key.expected[f.key])).toBe(true);
    }
  });
});

describe("ML grading", () => {
  it("accepts predictions that reach the target and rejects wrong shapes", async () => {
    const { mlTool } = await import("@/lib/arena-workstations/tools/ml");
    const d = build("ml-churn-accuracy", 0);
    const key = d.key as Extract<MlDraft["key"], { kind: "predict" }>;
    const good = await mlTool.grade(d.content as never, key as never, { predictions: fitAndPredict(d, false) });
    expect(good.passed).toBe(true);
    expect((await mlTool.grade(d.content as never, key as never, { predictions: key.yTest.slice(1) })).passed).toBe(false);
    expect((await mlTool.grade(d.content as never, key as never, { predictions: key.yTest.map(() => 2) })).passed).toBe(false);
    expect((await mlTool.grade(d.content as never, key as never, { predictions: key.yTest.map((y) => 1 - y) })).passed).toBe(false);
  });

  it("grades numbers within tolerance and rejects blanks", async () => {
    const { mlTool } = await import("@/lib/arena-workstations/tools/ml");
    const d = build("ml-eval-imbalance", 0);
    const key = d.key as Extract<MlDraft["key"], { kind: "numbers" }>;
    const exact = Object.fromEntries(Object.entries(key.expected).map(([k, v]) => [k, String(v)]));
    expect((await mlTool.grade(d.content as never, key as never, { answers: exact })).passed).toBe(true);
    expect((await mlTool.grade(d.content as never, key as never, { answers: { ...exact, f1: "" } })).passed).toBe(false);
    expect((await mlTool.grade(d.content as never, key as never, { answers: { ...exact, recall: "0.9" } })).passed).toBe(false);
  });
});
