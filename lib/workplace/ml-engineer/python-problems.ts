import type { Rng } from "../rng";
import { problem } from "../application-developer/code-problems";

/**
 * AI/ML Engineer Python tickets for the shared code workstation: the plain-Python building blocks under ML code (scaling, metrics, batching, encoding,
 * similarity search) with no library. The student's function runs in their browser; the server compares what it returned with the answers below.
 */
const CAST = {
  lead: { name: "Kavya Iyer", title: "ML Platform Lead" },
  qa: { name: "Joseph Thomas", title: "QA Lead" },
};
const round = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;

const minmaxScale = (values: number[]) => {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  return values.map((v) => (hi === lo ? 0 : round((v - lo) / (hi - lo), 4)));
};

const prf = (yTrue: number[], yPred: number[]) => {
  let tp = 0, fp = 0, fn = 0;
  yTrue.forEach((t, i) => { if (yPred[i] === 1 && t === 1) tp++; else if (yPred[i] === 1) fp++; else if (t === 1) fn++; });
  const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
  const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
  return { precision: round(precision, 3), recall: round(recall, 3), f1: precision + recall === 0 ? 0 : round((2 * precision * recall) / (precision + recall), 3) };
};

const movingAverage = (values: number[], window: number) => Array.from({ length: Math.max(0, values.length - window + 1) }, (_, i) => round(values.slice(i, i + window).reduce((s, v) => s + v, 0) / window, 3));

const oneHot = (labels: string[]) => {
  const classes = [...new Set(labels)].sort();
  return labels.map((l) => classes.map((c) => (c === l ? 1 : 0)));
};

const cosine = (a: number[], b: number[]) => {
  const dot = a.reduce((s, x, i) => s + x * b[i], 0);
  const na = Math.sqrt(a.reduce((s, x) => s + x * x, 0));
  const nb = Math.sqrt(b.reduce((s, x) => s + x * x, 0));
  return na === 0 || nb === 0 ? 0 : dot / (na * nb);
};
const topK = (query: number[], docs: number[][], k: number) =>
  docs.map((d, i) => ({ i, s: round(cosine(query, d), 6) })).sort((a, b) => b.s - a.s || a.i - b.i).slice(0, Math.max(0, k)).map((x) => x.i);

const nums = (rng: Rng, len: number, lo: number, hi: number) => Array.from({ length: len }, () => rng.int(lo, hi));
const vec = (rng: Rng, dim: number) => Array.from({ length: dim }, () => rng.int(-3, 5));

export const ML_ENGINEER_PYTHON_PROBLEMS = [
  problem({
    id: "mlpy-minmax-scale", area: "mle-python", difficulty: "easy", minLevel: "fresher", fn: "minmax_scale", params: ["values"], requester: CAST.lead,
    title: "Scale a feature to the 0-1 range",
    scenario: "Hi, before the distance-based model sees the monthly spend column it has to be on the same scale as the others. Please write the scaling without a library so we can reuse it in the serving code.",
    deliverable: "Write minmax_scale(values) returning a list where each value v becomes (v - min) / (max - min), rounded to 4 decimals. If every value is the same (max equals min) return 0 for each. An empty list returns an empty list.",
    tags: ["Feature scaling", "Python", "Edge cases"],
    cases: (rng) => [[[5, 10, 15]], [[7, 7, 7]], [[3]], [[-4, 0, 4, 8]], ...Array.from({ length: 6 }, () => [nums(rng, rng.int(1, 8), -20, 50)])],
    solve: ((v: number[]) => (v.length ? minmaxScale(v) : [])) as never,
  }),
  problem({
    id: "mlpy-precision-recall-f1", area: "mle-python", difficulty: "easy", minLevel: "fresher", fn: "precision_recall_f1", params: ["y_true", "y_pred"], requester: CAST.lead,
    title: "Compute precision, recall and F1 without a library",
    scenario: "Hello, the serving container has no scikit-learn, but the monitoring job still needs the model's precision, recall and F1 on yesterday's labelled requests. Please write it in plain Python.",
    deliverable: "Write precision_recall_f1(y_true, y_pred) for 0/1 labels, returning {precision, recall, f1} each rounded to 3 decimals. When a denominator would be zero (nothing predicted positive, no actual positives, or precision + recall = 0) that value is 0.",
    tags: ["Model evaluation", "Precision and recall", "Python"],
    cases: (rng) => [[[1, 0, 1, 1, 0], [1, 0, 0, 1, 1]], [[0, 0, 0], [0, 0, 0]], [[1, 1], [0, 0]], [[0, 0], [1, 1]], ...Array.from({ length: 6 }, () => { const n = rng.int(4, 14); return [nums(rng, n, 0, 1), nums(rng, n, 0, 1)]; })],
    solve: prf as never,
  }),
  problem({
    id: "mlpy-debug-moving-average", area: "mle-python", difficulty: "easy", minLevel: "fresher", fn: "moving_average", params: ["values", "window"], requester: CAST.qa,
    title: "Fix: the smoothed daily metric is wrong at the start and the end",
    scenario: "Hi, the dashboard line for the model's daily score is wrong: it has too many points, and the first ones are averages of fewer days. The moving average below was written in a hurry. Please fix it.",
    deliverable: "Fix moving_average(values, window) so it returns one average for each full window of consecutive values, in order, rounded to 3 decimals. For 5 values and a window of 3 it returns 3 numbers. If there are fewer values than the window it returns an empty list.",
    tags: ["Debugging", "Rolling metrics", "Python"],
    cases: (rng) => [[[1, 2, 3, 4, 5], 3], [[10, 20], 3], [[4, 4, 4], 1], [[1, 3, 5, 7], 4], ...Array.from({ length: 6 }, () => [nums(rng, rng.int(2, 9), 0, 30), rng.int(1, 4)])],
    solve: movingAverage as never,
    broken: {
      python: "def moving_average(values, window):\n    out = []\n    for i in range(len(values)):\n        chunk = values[max(0, i - window + 1):i + 1]\n        out.append(round(sum(chunk) / len(chunk), 3))\n    return out\n",
      javascript: "function moving_average(values, window) {\n  const out = [];\n  for (let i = 0; i < values.length; i++) {\n    const chunk = values.slice(Math.max(0, i - window + 1), i + 1);\n    out.push(Math.round((chunk.reduce((s, v) => s + v, 0) / chunk.length) * 1000) / 1000);\n  }\n  return out;\n}\n",
    },
  }),
  problem({
    id: "mlpy-one-hot", area: "mle-python", difficulty: "medium", minLevel: "fresher", fn: "one_hot", params: ["labels"], requester: CAST.lead,
    title: "One-hot encode a column and keep the columns in a fixed order",
    scenario: "Hi, the plan column has to be one-hot encoded the same way in training and in serving, otherwise the model reads the wrong column. Please write the encoder so the column order never depends on which row came first.",
    deliverable: "Write one_hot(labels) returning one row per label: a list of 0 and 1 with one position per distinct label, the labels sorted alphabetically to give the column order. For ['pro', 'basic', 'pro'] the columns are basic, pro and the result is [[0, 1], [1, 0], [0, 1]]. An empty list returns an empty list.",
    tags: ["Feature engineering", "Encoding", "Python"],
    cases: (rng) => [[["pro", "basic", "pro"]], [[]], [["a"]], ...Array.from({ length: 7 }, () => [Array.from({ length: rng.int(1, 9) }, () => rng.pick(["basic", "plus", "pro", "trial", "enterprise"]))])],
    solve: oneHot as never,
  }),
  problem({
    id: "mlpy-cosine-top-k", area: "mle-python", difficulty: "medium", minLevel: "fresher", fn: "top_k_similar", params: ["query", "docs", "k"], requester: CAST.lead,
    title: "Find the k most similar items by cosine similarity",
    scenario: "Hello, the search feature turns every item into a vector of numbers (an embedding) and shows the items closest in meaning to the query. Before we use a vector database I want the plain version working: which items are closest to the query vector?",
    deliverable: "Write top_k_similar(query, docs, k). Cosine similarity of two vectors is their dot product divided by the product of their lengths, and 0 if either vector has length 0. Return the indexes of the k documents most similar to the query, most similar first; round each similarity to 6 decimals before comparing, and break ties by the lower index. If k is larger than the number of documents return all of them.",
    tags: ["Embeddings", "Similarity search", "Retrieval"],
    cases: (rng) => [[[1, 0], [[1, 0], [0, 1], [1, 1]], 2], [[0, 0], [[1, 0], [0, 1]], 1], [[1, 2], [[2, 4], [1, 2], [-1, -2]], 3], ...Array.from({ length: 7 }, () => [vec(rng, 3), Array.from({ length: rng.int(2, 6) }, () => vec(rng, 3)), rng.int(1, 4)])],
    solve: topK as never,
  }),
];
