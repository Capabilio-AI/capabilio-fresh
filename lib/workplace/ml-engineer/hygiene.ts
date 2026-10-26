import type { Rng } from "../rng";
import { MAX_SUBMISSIONS, MlRejected, type MlDraft, type Texts } from "../ml/tickets";
import { csv } from "../ml/world";

// Training hygiene: reading an overfitting curve, sizing class weights for an imbalanced label, and catching rows that leak from train into test.

const round = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;
const DEPTHS = 12;
const GAP_LIMIT = 0.1;
const EDGE = 0.002;

/** Train and validation accuracy of a tree at depths 1..12: validation peaks and then falls while training keeps rising. */
export function buildOverfit(rng: Rng, texts: Texts): MlDraft {
  const peak = rng.int(4, 7);
  const top = 0.8 + rng.next() * 0.06;
  let trainSoFar = 0;
  const rows = Array.from({ length: DEPTHS }, (_, i) => {
    const d = i + 1;
    trainSoFar = Math.max(trainSoFar, Math.min(0.999, 0.68 + 0.028 * d + rng.next() * 0.01));
    const val = top - (d < peak ? 0.025 * (peak - d) : 0.012 * (d - peak)) + (rng.next() - 0.5) * 0.004;
    return { d, train: round(trainSoFar, 3), val: round(val, 3) };
  });
  const byVal = [...rows].sort((a, b) => b.val - a.val);
  if (byVal[0].d !== peak || byVal[0].val - byVal[1].val < EDGE) throw new MlRejected("no clear best depth");
  const gaps = rows.map((r) => round(r.train - r.val, 3));
  if (gaps.some((g) => Math.abs(g - GAP_LIMIT) < EDGE)) throw new MlRejected("a gap sits on the limit");
  const first = rows.find((_, i) => gaps[i] > GAP_LIMIT);
  if (!first) throw new MlRejected("the model never overfits");
  return {
    title: texts.title, requester: texts.requester, scenario: texts.scenario,
    skillTags: ["Overfitting", "Model selection", "Validation"],
    content: {
      company: texts.company, kind: "numbers",
      files: [{ name: "depth_sweep.csv", text: csv(["max_depth", "train_accuracy", "validation_accuracy"], rows.map((r) => [r.d, r.train, r.val])) }],
      starter: `import pandas as pd

sweep = pd.read_csv("depth_sweep.csv")   # one decision tree per max_depth, trained on the same split
`,
      fields: [
        { key: "best_depth", label: "max_depth to ship", help: "The depth with the highest validation accuracy." },
        { key: "best_val", label: "Its validation accuracy", help: "Three decimals." },
        { key: "gap_deepest", label: `Train minus validation accuracy at depth ${DEPTHS}`, help: "Three decimals." },
        { key: "first_overfit", label: `First depth where train minus validation is above ${GAP_LIMIT}` },
      ],
      maxSubmissions: MAX_SUBMISSIONS, deliverable: "Read the depth sweep and report the four numbers.",
    },
    key: {
      kind: "numbers",
      expected: { best_depth: peak, best_val: byVal[0].val, gap_deepest: gaps[DEPTHS - 1], first_overfit: first.d },
      tolerance: { best_depth: 0, best_val: 0.0005, gap_deepest: 0.0015, first_overfit: 0 },
    },
  };
}

/** A rare label: the lazy baseline and the "balanced" class weights scikit-learn would use. */
export function buildImbalance(rng: Rng, texts: Texts): MlDraft {
  const n = rng.int(800, 1500);
  const rate = 0.06 + rng.next() * 0.09;
  const labels = Array.from({ length: n }, () => (rng.chance(rate) ? 1 : 0));
  const pos = labels.filter((l) => l === 1).length;
  if (pos < 20) throw new MlRejected("too few positives");
  const neg = n - pos;
  return {
    title: texts.title, requester: texts.requester, scenario: texts.scenario,
    skillTags: ["Class imbalance", "Class weights", "Baselines"],
    content: {
      company: texts.company, kind: "numbers",
      files: [{ name: "labels.csv", text: csv(["row_id", "label"], labels.map((l, i) => [i + 1, l])) }],
      starter: `import pandas as pd

y = pd.read_csv("labels.csv")["label"]
# "balanced" weight of a class = n_rows / (n_classes * rows_in_that_class), as sklearn's compute_class_weight("balanced") does
`,
      fields: [
        { key: "positive_share", label: "Share of rows with label 1", help: "Three decimals." },
        { key: "baseline", label: "Accuracy of a model that always predicts 0", help: "Three decimals." },
        { key: "weight_pos", label: "Balanced weight for class 1", help: "Three decimals." },
        { key: "weight_neg", label: "Balanced weight for class 0", help: "Three decimals." },
      ],
      maxSubmissions: MAX_SUBMISSIONS, deliverable: "Size up the imbalance and report the four numbers.",
    },
    key: {
      kind: "numbers",
      expected: { positive_share: round(pos / n, 3), baseline: round(neg / n, 3), weight_pos: round(n / (2 * pos), 3), weight_neg: round(n / (2 * neg), 3) },
      tolerance: { positive_share: 0.002, baseline: 0.002, weight_pos: 0.002, weight_neg: 0.002 },
    },
  };
}

/** The same customers sit in train and test, so the test score is inflated. Count the overlap and what is left. */
export function buildOverlap(rng: Rng, texts: Texts): MlDraft {
  const ids = rng.shuffle(Array.from({ length: 3000 }, (_, i) => 20001 + i));
  const trainIds = ids.slice(0, 1000);
  const overlap = rng.int(25, 70);
  const fresh = ids.slice(1000, 1000 + 300 - overlap);
  const repeats = rng.shuffle(fresh).slice(0, rng.int(5, 12));
  const testIds = rng.shuffle([...rng.shuffle(trainIds).slice(0, overlap), ...fresh, ...repeats]);
  const row = (id: number) => [id, rng.int(1, 60), round(150 + rng.next() * 750, 2)];
  return {
    title: texts.title, requester: texts.requester, scenario: texts.scenario,
    skillTags: ["Data leakage", "Train/test split", "pandas"],
    content: {
      company: texts.company, kind: "numbers",
      files: [
        { name: "train.csv", text: csv(["customer_id", "tenure_months", "monthly_spend", "left"], trainIds.map((id) => [...row(id), rng.chance(0.3) ? 1 : 0])) },
        { name: "test.csv", text: csv(["customer_id", "tenure_months", "monthly_spend"], testIds.map(row)) },
      ],
      starter: `import pandas as pd

train = pd.read_csv("train.csv")
test = pd.read_csv("test.csv")
# a customer who appears in both files lets the model be tested on someone it already learned from
`,
      fields: [
        { key: "overlap_rows", label: "Rows of test.csv whose customer_id is also in train.csv" },
        { key: "contaminated_share", label: "Share of test.csv rows that are contaminated", help: "Three decimals." },
        { key: "distinct_test", label: "Distinct customers in test.csv" },
        { key: "clean_customers", label: "Distinct test customers never seen in training" },
      ],
      maxSubmissions: MAX_SUBMISSIONS, deliverable: "Measure the leak between the files and report the four numbers.",
    },
    key: {
      kind: "numbers",
      expected: { overlap_rows: overlap, contaminated_share: round(overlap / testIds.length, 3), distinct_test: overlap + fresh.length, clean_customers: fresh.length },
      tolerance: { overlap_rows: 0, contaminated_share: 0.002, distinct_test: 0, clean_customers: 0 },
    },
  };
}
