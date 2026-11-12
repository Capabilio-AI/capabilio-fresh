import type { Rng } from "../rng";
import { MAX_SUBMISSIONS, MlRejected, type MlDraft, type Texts } from "../ml/tickets";
import { csv } from "../ml/world";

// Algorithm selection and tuning, as numbers the notebook can produce from result tables: cross-validation comparison, a hyperparameter grid, the
// k-means elbow, ROC-AUC and PCA variance. Every answer is computed here from the generated rows.

const round = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;
const mean = (xs: readonly number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
const sampleStd = (xs: readonly number[]) => Math.sqrt(xs.reduce((s, x) => s + (x - mean(xs)) ** 2, 0) / (xs.length - 1));
const MODELS = ["logistic_regression", "decision_tree", "random_forest", "svm", "gradient_boosting"];

/** Five models, five folds each: the best mean, the most stable model, and whether the winner clearly beats the runner-up. */
export function buildCvComparison(rng: Rng, texts: Texts): MlDraft {
  const centres = rng.shuffle([0.74, 0.77, 0.8, 0.83, 0.86]);
  const spreads = rng.shuffle([0.006, 0.012, 0.02, 0.03, 0.04]);
  const folds = MODELS.map((_, m) => Array.from({ length: 5 }, () => round(centres[m] + (rng.next() - 0.5) * 2 * spreads[m], 3)));
  const means = folds.map(mean);
  const stds = folds.map(sampleStd);
  const order = means.map((_, i) => i).sort((a, b) => means[b] - means[a]);
  const best = order[0];
  const second = order[1];
  const stable = stds.map((_, i) => i).sort((a, b) => stds[a] - stds[b])[0];
  const gap = (means[best] - means[second]) / stds[best];
  if (means[best] - means[second] < 0.01 || Math.abs(gap - 1) < 0.15) throw new MlRejected("no clear winner or a knife edge");
  return {
    title: texts.title, requester: texts.requester, scenario: texts.scenario,
    skillTags: ["Algorithm selection", "Cross-validation", "pandas"],
    content: {
      company: texts.company, kind: "numbers",
      files: [{ name: "cv_results.csv", text: csv(["model_id", "model", "fold_1", "fold_2", "fold_3", "fold_4", "fold_5"], MODELS.map((name, m) => [m + 1, name, ...folds[m]])) }],
      starter: `import pandas as pd

cv = pd.read_csv("cv_results.csv")   # validation accuracy of each model on each of 5 folds
# use the sample standard deviation across the 5 folds (ddof=1, the pandas default)
`,
      fields: [
        { key: "best_id", label: "model_id with the highest mean accuracy" },
        { key: "best_mean", label: "Its mean accuracy", help: "Four decimals." },
        { key: "stable_id", label: "model_id with the lowest standard deviation", help: "The most stable model." },
        { key: "gap_sigmas", label: "Winner's lead over the runner-up, in the winner's standard deviations", help: "(best mean - runner-up mean) / best std. Two decimals." },
        { key: "clear_win", label: "Is the win clear? 1 = yes, 0 = no", help: "Yes when the lead is more than 1 standard deviation of the winner." },
      ],
      maxSubmissions: MAX_SUBMISSIONS, deliverable: "Compare the five models across folds and report the five numbers.",
    },
    key: { kind: "numbers", expected: { best_id: best + 1, best_mean: round(means[best], 4), stable_id: stable + 1, gap_sigmas: round(gap, 2), clear_win: gap > 1 ? 1 : 0 }, tolerance: { best_id: 0, best_mean: 0.0003, stable_id: 0, gap_sigmas: 0.02, clear_win: 0 } },
  };
}

/** A hyperparameter grid with training and validation scores: pick on validation and count the combinations that overfit. */
export function buildGridSearch(rng: Rng, texts: Texts): MlDraft {
  const Cs = [0.1, 1, 10, 100];
  const gammas = [0.001, 0.01, 0.1, 1];
  const rows = Cs.flatMap((c, ci) => gammas.map((g, gi) => {
    const flex = ci + gi;
    const train = round(Math.min(0.999, 0.72 + flex * 0.045 + rng.next() * 0.02), 3);
    const val = round(0.7 + Math.min(flex, 3) * 0.035 - Math.max(0, flex - 3) * 0.045 + (rng.next() - 0.5) * 0.02, 3);
    return { C: c, gamma: g, train, val };
  }));
  const withId = rows.map((r, i) => ({ ...r, id: i + 1 }));
  const best = [...withId].sort((a, b) => b.val - a.val)[0];
  const overfit = withId.filter((r) => r.train - r.val > 0.1).length;
  const sorted = [...withId].sort((a, b) => b.val - a.val);
  if (sorted[0].val - sorted[1].val < 0.004 || overfit === 0) throw new MlRejected("no clear best or no overfit combinations");
  const bestTrain = [...withId].sort((a, b) => b.train - a.train)[0];
  return {
    title: texts.title, requester: texts.requester, scenario: texts.scenario,
    skillTags: ["Hyperparameter tuning", "Grid search", "Overfitting"],
    content: {
      company: texts.company, kind: "numbers",
      files: [{ name: "grid.csv", text: csv(["combo_id", "C", "gamma", "train_accuracy", "val_accuracy"], withId.map((r) => [r.id, r.C, r.gamma, r.train, r.val])) }],
      starter: `import pandas as pd

grid = pd.read_csv("grid.csv")   # an SVM grid search: training and validation accuracy for every (C, gamma) pair
# a combination overfits when train_accuracy is more than 0.10 above val_accuracy
`,
      fields: [
        { key: "best_combo", label: "combo_id to use", help: "The highest val_accuracy." },
        { key: "best_val", label: "Its val_accuracy", help: "Three decimals." },
        { key: "its_gap", label: "Its train_accuracy minus val_accuracy", help: "Three decimals." },
        { key: "overfit_combos", label: "Combinations that overfit" },
        { key: "tempting_combo", label: "combo_id with the highest train_accuracy", help: "The one you must not pick because of training accuracy." },
      ],
      maxSubmissions: MAX_SUBMISSIONS, deliverable: "Choose the combination the right way and report the five numbers.",
    },
    key: { kind: "numbers", expected: { best_combo: best.id, best_val: best.val, its_gap: round(best.train - best.val, 3), overfit_combos: overfit, tempting_combo: bestTrain.id }, tolerance: { best_combo: 0, best_val: 0.0005, its_gap: 0.0015, overfit_combos: 0, tempting_combo: 0 } },
  };
}

/** Inertia for k = 1..8: the elbow is where the curve bends most (the largest second difference). */
export function buildKmeansElbow(rng: Rng, texts: Texts): MlDraft {
  const bend = rng.int(3, 5);
  const inertia: number[] = [rng.int(900, 1200)];
  for (let k = 2; k <= 8; k++) inertia.push(Math.round(inertia[k - 2] - (k <= bend ? inertia[k - 2] * (0.28 + rng.next() * 0.1) : inertia[k - 2] * (0.03 + rng.next() * 0.04))));
  const second = new Map<number, number>();
  for (let k = 2; k <= 7; k++) second.set(k, inertia[k - 2] - 2 * inertia[k - 1] + inertia[k]);
  const ranked = [...second.entries()].sort((a, b) => b[1] - a[1]);
  if (ranked[0][1] - ranked[1][1] < 15) throw new MlRejected("no clear elbow");
  const [elbow, bendSize] = ranked[0];
  return {
    title: texts.title, requester: texts.requester, scenario: texts.scenario,
    skillTags: ["Clustering", "K-means", "Elbow method"],
    content: {
      company: texts.company, kind: "numbers",
      files: [{ name: "inertia.csv", text: csv(["k", "inertia"], inertia.map((v, i) => [i + 1, v])) }],
      starter: `import pandas as pd

inertia = pd.read_csv("inertia.csv")   # total within-cluster squared distance for k = 1 to 8 clusters
# the elbow is the k (from 2 to 7) with the largest second difference:
#   inertia[k-1] - 2 * inertia[k] + inertia[k+1]
`,
      fields: [
        { key: "elbow_k", label: "The elbow k" },
        { key: "second_diff", label: "The second difference at the elbow" },
        { key: "drop_pct", label: "Percent by which inertia falls from k = 1 to the elbow", help: "One decimal." },
      ],
      maxSubmissions: MAX_SUBMISSIONS, deliverable: "Find the elbow of the inertia curve and report the three numbers.",
    },
    key: { kind: "numbers", expected: { elbow_k: elbow, second_diff: bendSize, drop_pct: round(((inertia[0] - inertia[elbow - 1]) / inertia[0]) * 100, 1) }, tolerance: { elbow_k: 0, second_diff: 0, drop_pct: 0.06 } },
  };
}

/** ROC-AUC from scores, by ranking: the chance a random positive scores above a random negative (ties count half). */
export function buildRocAuc(rng: Rng, texts: Texts): MlDraft {
  const rows = Array.from({ length: 60 }, (_, i) => {
    const y = rng.chance(0.35) ? 1 : 0;
    return { id: i + 1, y, score: round(Math.min(0.99, Math.max(0.01, (y ? 0.62 : 0.4) + (rng.next() - 0.5) * 0.7)), 2) };
  });
  const pos = rows.filter((r) => r.y === 1);
  const neg = rows.filter((r) => r.y === 0);
  if (pos.length < 10 || neg.length < 20) throw new MlRejected("too few of one class");
  let wins = 0;
  for (const p of pos) for (const q of neg) wins += p.score > q.score ? 1 : p.score === q.score ? 0.5 : 0;
  const auc = wins / (pos.length * neg.length);
  const tp = pos.filter((r) => r.score >= 0.5).length;
  const fp = neg.filter((r) => r.score >= 0.5).length;
  return {
    title: texts.title, requester: texts.requester, scenario: texts.scenario,
    skillTags: ["Model evaluation", "ROC-AUC", "Thresholds"],
    content: {
      company: texts.company, kind: "numbers",
      files: [{ name: "scores.csv", text: csv(["row_id", "actual", "score"], rows.map((r) => [r.id, r.y, r.score])) }],
      starter: `import pandas as pd

s = pd.read_csv("scores.csv")   # actual: 1 = leaver; score: the model's probability of leaving
# ROC-AUC = the share of (leaver, stayer) pairs where the leaver has the higher score; a tie counts as half
`,
      fields: [
        { key: "auc", label: "ROC-AUC", help: "Three decimals." },
        { key: "positives", label: "Number of leavers (actual = 1)" },
        { key: "tpr_at_half", label: "Recall at threshold 0.5", help: "Predict leave when score >= 0.5. Three decimals." },
        { key: "fpr_at_half", label: "False positive rate at threshold 0.5", help: "Stayers wrongly flagged / all stayers. Three decimals." },
      ],
      maxSubmissions: MAX_SUBMISSIONS, deliverable: "Compute the ROC-AUC and the two rates at 0.5 and report the four numbers.",
    },
    key: { kind: "numbers", expected: { auc: round(auc, 3), positives: pos.length, tpr_at_half: round(tp / pos.length, 3), fpr_at_half: round(fp / neg.length, 3) }, tolerance: { auc: 0.0015, positives: 0, tpr_at_half: 0.0015, fpr_at_half: 0.0015 } },
  };
}

/** Eigenvalues of the covariance matrix: explained variance, and how many components keep 90%. */
export function buildPcaVariance(rng: Rng, texts: Texts): MlDraft {
  const count = rng.int(6, 9);
  const raw = Array.from({ length: count }, (_, i) => round((count - i) ** 1.7 * (0.8 + rng.next() * 0.4), 2)).sort((a, b) => b - a);
  const total = raw.reduce((s, v) => s + v, 0);
  const cum = raw.map((_, i) => raw.slice(0, i + 1).reduce((s, v) => s + v, 0) / total);
  const keep = cum.findIndex((c) => c >= 0.9) + 1;
  if (keep < 2 || keep >= count || Math.abs(cum[keep - 1] - 0.9) < 0.006 || Math.abs(cum[keep - 2] - 0.9) < 0.006) throw new MlRejected("the 90% line sits on a knife edge");
  return {
    title: texts.title, requester: texts.requester, scenario: texts.scenario,
    skillTags: ["Dimensionality reduction", "PCA", "Explained variance"],
    content: {
      company: texts.company, kind: "numbers",
      files: [{ name: "eigenvalues.csv", text: csv(["component", "eigenvalue"], raw.map((v, i) => [i + 1, v])) }],
      starter: `import pandas as pd

e = pd.read_csv("eigenvalues.csv")   # eigenvalues of the covariance matrix, one per principal component, largest first
# explained variance ratio of a component = its eigenvalue / the sum of all eigenvalues
`,
      fields: [
        { key: "pc1_ratio", label: "Explained variance ratio of the first component", help: "Three decimals." },
        { key: "top2_ratio", label: "Cumulative explained variance of the first two components", help: "Three decimals." },
        { key: "keep", label: "Components needed to keep at least 90% of the variance" },
        { key: "kept_ratio", label: "Cumulative variance kept by those components", help: "Three decimals." },
      ],
      maxSubmissions: MAX_SUBMISSIONS, deliverable: "Work out the explained variance and how many components to keep.",
    },
    key: { kind: "numbers", expected: { pc1_ratio: round(raw[0] / total, 3), top2_ratio: round(cum[1], 3), keep, kept_ratio: round(cum[keep - 1], 3) }, tolerance: { pc1_ratio: 0.0015, top2_ratio: 0.0015, keep: 0, kept_ratio: 0.0015 } },
  };
}
