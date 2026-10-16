import type { ExperienceLevel } from "../level";
import type { Rng } from "../rng";
import type { Difficulty } from "@/lib/arena-workstations/types";
import { accuracy, confusion, f1, precision, recall, score, sigmoid, type MlMetric } from "./metrics";
import { referencePredict } from "./reference";
import { CHURN_SPEC, isNumeric, makeRows, type DatasetSpec } from "./spec";
import { csv, makeSplit } from "./world";

export interface FieldSpec {
  key: string;
  label: string;
  help?: string;
}

/** What the user sees. Never the test labels or the expected numbers. */
export interface MlContent {
  company: string;
  kind: "predict" | "numbers";
  metric?: MlMetric;
  /** files the notebook can read, for example train.csv and test.csv */
  files: { name: string; text: string }[];
  starter: string;
  fields: FieldSpec[];
  expectedPredictions?: number;
  maxSubmissions: number;
  deliverable: string;
}

export type MlKey =
  | { kind: "predict"; metric: MlMetric; yTest: number[]; threshold: number; baseline: number }
  | { kind: "numbers"; expected: Record<string, number>; tolerance: Record<string, number> };

export interface MlDraft {
  title: string;
  requester: { name: string; title: string };
  scenario: string;
  skillTags: string[];
  content: MlContent;
  key: MlKey;
}

/** The words of a ticket; the AI writes them for its scenario, or the fixed text below stands in for the fallback. */
export interface Texts {
  company: string;
  title: string;
  scenario: string;
  requester: { name: string; title: string };
}

export interface MlTemplate {
  id: string;
  /** the fixed title, so a template need not be built (and a model trained) just to compare titles */
  title: string;
  areas: string[];
  difficulty: Difficulty;
  minLevel: ExperienceLevel;
  build(rng: Rng): MlDraft;
}

export class MlRejected extends Error {}

export const MAX_SUBMISSIONS = 5;
/** Fraction of the way from the lazy answer to the best possible one that a model must reach. */
const REACH: Record<Difficulty, number> = { easy: 0.45, medium: 0.55, hard: 0.65 };
const MIN_GAP: Record<MlMetric, number> = { accuracy: 0.06, f1: 0.12 };
const SPLIT_TRIES = 3;
export const MATH_OPS = ["linear_step", "logistic_step", "softmax", "z_scores"] as const;
export type MathOp = (typeof MATH_OPS)[number];

const round = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;
const median = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

function predictStarter(spec: DatasetSpec, leak: boolean): string {
  if (!leak) {
    return `import pandas as pd

train = pd.read_csv("train.csv")
test = pd.read_csv("test.csv")

# 1. look at the data, 2. prepare the features, 3. train a model on train.csv (the answer column is "${spec.target.name}")
# 4. predict for every row of test.csv, in the same order:
# predictions = [...]   # a list of 0 / 1, one per row of test.csv
`;
  }
  const numeric = spec.features.filter(isNumeric).map((f) => `"${f.name}"`);
  return `import pandas as pd
from sklearn.linear_model import LogisticRegression

train = pd.read_csv("train.csv")
test = pd.read_csv("test.csv")

features = [${numeric.join(", ")}, "${spec.leak!.name}"]
X = train[features].fillna(0)
model = LogisticRegression(max_iter=1000).fit(X, train["${spec.target.name}"])
print("training accuracy:", model.score(X, train["${spec.target.name}"]))   # looks great...

predictions = list(model.predict(test[features].fillna(0)))   # ...but the results on new rows are poor
`;
}

/**
 * A prediction ticket on this scenario. It is only built if a plain model, which sees what the learner sees, reaches the pass mark on these very test
 * rows, and (for a leakage task) a model that trusts the leaked column does not. Otherwise MlRejected.
 */
export function buildPredict(spec: DatasetSpec, rng: Rng, difficulty: Difficulty, texts: Texts, opts: { leak?: boolean } = {}): MlDraft {
  const leak = !!opts.leak;
  if (leak && !spec.leak) throw new MlRejected("a leakage task needs a leaked column");
  let why = "";
  for (let i = 0; i < SPLIT_TRIES; i++) {
    const split = makeSplit(spec, rng, { leak });
    if (split.ceiling - split.baseline < MIN_GAP[split.metric]) { why = "the features barely predict the outcome"; continue; }
    const threshold = split.baseline + REACH[difficulty] * (split.ceiling - split.baseline);
    const honest = score(split.metric, split.yTest, referencePredict(spec, split.metric, split.train, split.test, split.leakTrain, false));
    if (honest < threshold) { why = "a plain model cannot reach the target"; continue; }
    if (leak && score(split.metric, split.yTest, referencePredict(spec, split.metric, split.train, split.test, split.leakTrain, true)) >= threshold) { why = "the leaked column does not mislead a model"; continue; }
    const meaning = spec.target.positive_meaning;
    return {
      title: texts.title, requester: texts.requester, scenario: texts.scenario,
      skillTags: leak ? ["Data leakage", "Debugging", "scikit-learn"] : ["scikit-learn", "Classification", split.metric === "f1" ? "Imbalanced data" : "Logistic regression"],
      content: {
        company: texts.company, kind: "predict", metric: split.metric, files: split.files, starter: predictStarter(spec, leak), fields: [], expectedPredictions: split.testRows, maxSubmissions: MAX_SUBMISSIONS,
        deliverable: `${leak ? "Fix the pipeline and predict" : "Predict"} 1 (${meaning}) or 0 (not) for every row of test.csv. ${split.metric === "f1" ? `Scoring is by F1 on the rows where ${meaning}, so accuracy alone will mislead you.` : "Your predictions are scored on rows whose outcome you are not shown."}`,
      },
      key: { kind: "predict", metric: split.metric, yTest: split.yTest, threshold, baseline: split.baseline },
    };
  }
  throw new MlRejected(why);
}

/** Clean a messy export the standard way and report numbers off the clean table. Everything is computed from the generated rows. */
export function buildPrep(spec: DatasetSpec, rng: Rng, texts: Texts): MlDraft {
  const num = spec.features.filter(isNumeric);
  const n1 = num[0];
  const c1 = spec.features.find((f) => f.kind === "category")!;
  if (c1.kind !== "category") throw new MlRejected("no category feature");
  const rows = makeRows(spec, rng, 240);
  const cells = rows.map((r) => [r.id, ...spec.features.map((f) => {
    const v = r.values[f.name];
    if (f.name === n1.name) return rng.chance(0.1) ? null : v;
    if (f.name === c1.name) return rng.pick([v as string, (v as string).toUpperCase(), ` ${v} `]);
    return rng.chance(f.missing) ? null : v;
  })]);
  const raw = [...cells, ...rng.shuffle(cells).slice(0, 8)];
  const known = cells.map((r) => r[1 + spec.features.findIndex((f) => f.name === n1.name)]).filter((v): v is number => v !== null);
  if (known.length < 100) throw new MlRejected("too few known values");
  const med = median(known);
  const mean = (known.reduce((s, v) => s + v, 0) + med * (cells.length - known.length)) / cells.length;
  return {
    title: texts.title, requester: texts.requester, scenario: texts.scenario,
    skillTags: ["pandas", "Data preparation", "Missing values", "Deduplication"],
    content: {
      company: texts.company, kind: "numbers",
      files: [{ name: "raw.csv", text: csv([spec.id_column, ...spec.features.map((f) => f.name)], rng.shuffle(raw)) }],
      starter: `import pandas as pd

df = pd.read_csv("raw.csv")
# 1. drop duplicate rows (same ${spec.id_column})
# 2. make "${c1.name}" consistent (trim spaces, lower case)
# 3. fill missing "${n1.name}" with the MEDIAN of the known values
# then read the numbers below off the cleaned table
`,
      fields: [
        { key: "rows", label: "Rows after removing duplicates" },
        { key: "categories", label: `Distinct ${c1.name} values after cleaning` },
        { key: "median", label: `Median ${n1.name} used for filling`, help: "Of the known values, after removing duplicates. Two decimals." },
        { key: "mean", label: `Mean ${n1.name} after filling`, help: "Two decimals." },
      ],
      maxSubmissions: MAX_SUBMISSIONS, deliverable: "Clean the export as described and report the four numbers.",
    },
    key: { kind: "numbers", expected: { rows: cells.length, categories: c1.categories.length, median: round(med, 2), mean: round(mean, 2) }, tolerance: { rows: 0, categories: 0, median: 0.02, mean: 0.05 } },
  };
}

/** A model's predictions next to what happened, on a rare outcome: the accuracy looks fine and the model is not. */
export function buildEval(spec: DatasetSpec, rng: Rng, texts: Texts): MlDraft {
  const n = 400;
  const rate = Math.min(0.25, Math.max(0.06, spec.target.prevalence));
  const actual = Array.from({ length: n }, () => (rng.chance(rate) ? 1 : 0));
  const predicted = actual.map((a) => (a === 1 ? (rng.chance(0.6) ? 1 : 0) : rng.chance(0.05) ? 1 : 0));
  const c = confusion(actual, predicted);
  const alwaysNo = actual.filter((a) => a === 0).length / n;
  if (c.tp === 0 || c.fp === 0) throw new MlRejected("degenerate predictions");
  return {
    title: texts.title, requester: texts.requester,
    scenario: `${texts.scenario} The model team says it is ${Math.round(accuracy(c) * 100)}% accurate and wants to ship it. Below are its calls on ${n} cases next to what really happened ("${spec.target.positive_meaning}" is the 1). Tell me what it really achieves.`,
    skillTags: ["Evaluation", "Precision and recall", "Class imbalance"],
    content: {
      company: texts.company, kind: "numbers",
      files: [{ name: "results.csv", text: csv(["actual", "predicted"], actual.map((a, i) => [a, predicted[i]])) }],
      starter: `import pandas as pd

r = pd.read_csv("results.csv")   # actual: 1 = ${spec.target.positive_meaning};  predicted: the model's call
# count true positives, false positives, false negatives, true negatives
`,
      fields: [
        { key: "accuracy", label: "Accuracy of the model", help: "Three decimals." },
        { key: "precision", label: "Precision", help: "Of the cases it flagged, the share that really were 1. Three decimals." },
        { key: "recall", label: "Recall", help: "Of the cases that really were 1, the share it flagged. Three decimals." },
        { key: "f1", label: "F1 score", help: "Three decimals." },
        { key: "always_no", label: "Accuracy of a model that always predicts 0", help: "Three decimals." },
      ],
      maxSubmissions: MAX_SUBMISSIONS, deliverable: "Report the five numbers.",
    },
    key: { kind: "numbers", expected: { accuracy: round(accuracy(c), 3), precision: round(precision(c), 3), recall: round(recall(c), 3), f1: round(f1(c), 3), always_no: round(alwaysNo, 3) }, tolerance: { accuracy: 0.002, precision: 0.002, recall: 0.002, f1: 0.002, always_no: 0.002 } },
  };
}

/** A small piece of the maths under training, worked by hand with numbers made for this user. */
export function buildMath(op: MathOp, rng: Rng, texts: Texts): MlDraft {
  const base = { title: texts.title, requester: texts.requester, scenario: texts.scenario };
  const common = { company: texts.company, kind: "numbers" as const, files: [], maxSubmissions: MAX_SUBMISSIONS };
  const dp = (key: string, label: string, help: string, tol = 0.0005) => ({ field: { key, label, help }, tol: { [key]: tol } });
  if (op === "softmax") {
    const scores = Array.from({ length: 4 }, () => rng.int(-3, 5));
    const exps = scores.map(Math.exp);
    const sum = exps.reduce((a, b) => a + b, 0);
    const fields = scores.map((_, i) => dp(`p${i + 1}`, `probability of class ${i + 1}`, "Four decimals."));
    return { ...base, skillTags: ["NumPy", "Softmax", "Probabilities"], content: { ...common, starter: `import numpy as np\n\nscores = np.array(${JSON.stringify(scores)})\n# softmax: exp(score) divided by the sum of exp over all scores\n`, fields: fields.map((f) => f.field), deliverable: "Report the four probabilities the model assigns." }, key: { kind: "numbers", expected: Object.fromEntries(exps.map((e, i) => [`p${i + 1}`, round(e / sum, 4)])), tolerance: Object.assign({}, ...fields.map((f) => f.tol)) } };
  }
  if (op === "z_scores") {
    const values = Array.from({ length: 6 }, () => rng.int(10, 90));
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const sd = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length);
    const fields = [dp("mean", "mean", "Four decimals."), dp("std", "population standard deviation", "Divide by n, as np.std does. Four decimals."), dp("z_first", "z-score of the first value", "Four decimals.")];
    return { ...base, skillTags: ["NumPy", "Standardisation", "Feature scaling"], content: { ...common, starter: `import numpy as np\n\nvalues = np.array(${JSON.stringify(values)})\n# z-score = (value - mean) / standard deviation\n`, fields: fields.map((f) => f.field), deliverable: "Report the mean, the standard deviation and the z-score of the first value." }, key: { kind: "numbers", expected: { mean: round(mean, 4), std: round(sd, 4), z_first: round((values[0] - mean) / sd, 4) }, tolerance: Object.assign({}, ...fields.map((f) => f.tol)) } };
  }
  const xs = Array.from({ length: 5 }, () => [round(rng.int(1, 9) + rng.next(), 1), round(rng.int(1, 9) + rng.next(), 1)]);
  const logistic = op === "logistic_step";
  const ys = logistic ? xs.map((x) => (x[0] + rng.next() * 4 > x[1] + 2 ? 1 : 0)) : xs.map((x) => round(2 * x[0] - x[1] + 3 + (rng.next() - 0.5), 1));
  const w = [round(rng.next(), 2), round(rng.next(), 2)];
  const b = round(rng.next(), 2);
  const lr = rng.pick([0.01, 0.02, 0.05, 0.1]);
  const out = xs.map((x) => w[0] * x[0] + w[1] * x[1] + b);
  const err = logistic ? out.map((z, i) => sigmoid(z) - ys[i]) : out.map((z, i) => 2 * (z - ys[i]));
  const grad = (j: number) => xs.reduce((s, x, i) => s + err[i] * x[j], 0) / xs.length;
  const gb = err.reduce((s, e) => s + e, 0) / xs.length;
  const fields = [dp("w1", "new w[0]", "Four decimals."), dp("w2", "new w[1]", "Four decimals."), dp("b", "new b", "Four decimals.")];
  return {
    ...base, skillTags: ["NumPy", "Gradient descent", logistic ? "Logistic regression" : "Linear regression"],
    content: { ...common, starter: `import numpy as np\n\nX = np.array(${JSON.stringify(xs)})\ny = np.array(${JSON.stringify(ys)})\nw = np.array(${JSON.stringify(w)})\nb = ${b}\nlr = ${lr}\n${logistic ? "# p = 1 / (1 + exp(-(X @ w + b)));  loss = log loss;  dloss/dw = X.T @ (p - y) / n;  dloss/db = mean(p - y)" : "# prediction = X @ w + b ;  loss = mean((prediction - y) ** 2)"}\n# new_w = w - lr * dloss/dw ;  new_b = b - lr * dloss/db\n`, fields: fields.map((f) => f.field), deliverable: "Report the weights after ONE gradient descent step." },
    key: { kind: "numbers", expected: { w1: round(w[0] - lr * grad(0), 4), w2: round(w[1] - lr * grad(1), 4), b: round(b - lr * gb, 4) }, tolerance: Object.assign({}, ...fields.map((f) => f.tol)) },
  };
}

// ---- the fixed fallback: the same builders on the original subscription-churn scenario ----
const RETENTION = { name: "Divya Sethi", title: "Customer Retention Lead" };
const withRate = (prevalence: number): DatasetSpec => ({ ...CHURN_SPEC, target: { ...CHURN_SPEC.target, prevalence } });
const fixed = (title: string, scenario: string, requester = RETENTION): Texts => ({ company: "Nimbus Telecom", title, scenario, requester });

/** The fallback must always produce a ticket: when a scenario cannot be proven fair, try again with fresh data. */
const persist = (build: (rng: Rng) => MlDraft) => (rng: Rng): MlDraft => {
  let last: unknown;
  for (let i = 0; i < 4; i++) {
    try {
      return build(rng);
    } catch (e) {
      if (!(e instanceof MlRejected)) throw e;
      last = e;
    }
  }
  throw last;
};

export const ML_TEMPLATES: MlTemplate[] = [
  { id: "ml-churn-accuracy", title: "Predict which customers will leave", areas: ["model-training"], difficulty: "easy", minLevel: "fresher", build: persist((rng) => buildPredict(withRate(0.42), rng, "easy", fixed("Predict which customers will leave", "Hi, we lose too many subscribers and find out too late. Using the history of past customers, build a model that predicts who will leave, and give me its call for each customer in the new batch.")) ) },
  { id: "ml-churn-imbalanced", title: "Find the few customers about to leave", areas: ["model-training"], difficulty: "medium", minLevel: "junior", build: persist((rng) => buildPredict(withRate(0.12), rng, "medium", fixed("Find the few customers about to leave", "Hello, only about one customer in eight leaves each quarter, so 'everyone stays' is right most of the time and useless to us. I need the model to actually catch the leavers without flagging half the base.")) ) },
  { id: "ml-churn-hard", title: "Catch the leavers on a tight retention budget", areas: ["model-training"], difficulty: "hard", minLevel: "mid", build: persist((rng) => buildPredict(withRate(0.1), rng, "hard", fixed("Catch the leavers on a tight retention budget", "Hi, each retention call costs money, so I can only afford to call people who are likely to leave, but missing a leaver costs far more. Tune the model so the balance between the two is right.", { name: "Arvind Nair", title: "Finance Analytics Manager" })) ) },
  { id: "ml-leakage-refund", title: "Fix: the churn model is perfect in training and useless in production", areas: ["pipeline-debugging"], difficulty: "medium", minLevel: "junior", build: persist((rng) => buildPredict(withRate(0.15), rng, "medium", fixed("Fix: the churn model is perfect in training and useless in production", "Hi, a colleague's churn model scored almost 100% on the history but did badly when we used it on new customers. The code is below. Find out what is wrong and give me predictions I can trust."), { leak: true }) ) },
  { id: "ml-prep-clean", title: "Get the customer export ready for modelling", areas: ["data-preparation"], difficulty: "easy", minLevel: "fresher", build: (rng) => buildPrep(CHURN_SPEC, rng, fixed("Get the customer export ready for modelling", "Hi, the churn export came out of three different systems and is a mess: some rows appear twice, numbers have gaps and the category names are typed every way possible. Before anyone builds a model I need it cleaned the standard way, and a few numbers from the clean table so I can check your work.")) },
  { id: "ml-eval-imbalance", title: "Is the churn model as good as its accuracy says?", areas: ["evaluation"], difficulty: "medium", minLevel: "junior", build: (rng) => buildEval(CHURN_SPEC, rng, fixed("Is the churn model as good as its accuracy says?", "Hello, only a small share of customers actually leave, so I don't trust a headline accuracy number.", { name: "Mehul Shah", title: "Head of Product" })) },
  { id: "ml-fundamentals-gradient", title: "Take one gradient descent step by hand", areas: ["ml-fundamentals"], difficulty: "medium", minLevel: "junior", build: (rng) => buildMath("linear_step", rng, fixed("Take one gradient descent step by hand", "Hi, I want to be sure our new hire understands what training actually does, not only how to call fit(). Starting from the weights below, take ONE gradient descent step and report the new weights.", { name: "Mehul Shah", title: "Head of Product" })) },
];
