import type { Rng } from "../rng";
import { confusion, precision, recall, sigmoid } from "../ml/metrics";
import { MlRejected, type MlDraft, type Texts } from "../ml/tickets";
import { csv } from "../ml/world";
import { mean, normal, numbersDraft, round } from "./numbers";

/** Model-evaluation tickets: metrics at a threshold, the threshold a business cost implies, calibration, and over-fitting. */

/** A model's scores (3 decimals, so thresholds are exact) next to what happened. */
function scored(rng: Rng, n: number, prevalence: number): { actual: number[]; score: number[] } {
  const actual = Array.from({ length: n }, () => (rng.chance(prevalence) ? 1 : 0));
  return { actual, score: actual.map((a) => round(sigmoid(-1.4 + 2.4 * a + normal(rng)), 3)) };
}
const flagged = (score: readonly number[], t: number): number[] => score.map((s) => (s >= t ? 1 : 0));
const scoresFile = (actual: number[], score: number[]) => ({ name: "scores.csv", text: csv(["case_id", "actual", "score"], actual.map((a, i) => [i + 1, a, score[i]])) });
const STARTER = (note: string) => `import pandas as pd
import numpy as np

r = pd.read_csv("scores.csv")   # actual: what happened (1 = yes);  score: the model's probability
# a case is flagged when score >= threshold
${note}`;

export function thresholdMetrics(rng: Rng, texts: Texts): MlDraft {
  const { actual, score } = scored(rng, 400, 0.2);
  const c = confusion(actual, flagged(score, 0.5));
  if (c.tp === 0 || c.fp === 0 || c.fn === 0) throw new MlRejected("degenerate scores");
  return numbersDraft(texts, {
    skillTags: ["Model evaluation", "Precision and recall", "Classification threshold"],
    files: [scoresFile(actual, score)],
    starter: STARTER("# count true positives, false positives and false negatives at the threshold\n"),
    fields: [
      { key: "precision", label: "Precision at threshold 0.5", help: "Three decimals.", value: round(precision(c), 3), tolerance: 0.002 },
      { key: "recall", label: "Recall at threshold 0.5", help: "Three decimals.", value: round(recall(c), 3), tolerance: 0.002 },
      { key: "flagged_03", label: "Cases flagged if the threshold is lowered to 0.3", value: flagged(score, 0.3).reduce((s, v) => s + v, 0), tolerance: 0 },
    ],
    deliverable: "Report precision and recall at 0.5 and how many cases a 0.3 threshold would flag.",
  });
}

const THRESHOLDS = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7];

/** The threshold that costs the business least, and whether the model's high scores mean what they say. */
export function costAndCalibration(rng: Rng, texts: Texts): MlDraft {
  const missCost = rng.pick([4000, 5000, 6000]);
  const alarmCost = rng.pick([300, 500, 800]);
  const { actual, score } = scored(rng, 500, 0.18);
  const costs = THRESHOLDS.map((t) => {
    const c = confusion(actual, flagged(score, t));
    return { t, cost: c.fn * missCost + c.fp * alarmCost };
  }).sort((a, b) => a.cost - b.cost);
  if (costs[1].cost - costs[0].cost < alarmCost) throw new MlRejected("no clear cheapest threshold");
  const top = score.map((s, i) => [s, actual[i]]).filter(([s]) => s >= 0.7);
  if (top.length < 15) throw new MlRejected("too few high scores");
  return numbersDraft(texts, {
    skillTags: ["Model evaluation", "Cost-sensitive thresholds", "Calibration"],
    files: [scoresFile(actual, score)],
    starter: STARTER(`# a missed case (actual 1, not flagged) costs ₹${missCost}; a false alarm (actual 0, flagged) costs ₹${alarmCost}
# try the thresholds ${THRESHOLDS.join(", ")} and total the cost of each
`),
    fields: [
      { key: "best_threshold", label: "Cheapest threshold of those listed", value: costs[0].t, tolerance: 0.001 },
      { key: "best_cost", label: "Total cost at that threshold (₹)", value: costs[0].cost, tolerance: 1 },
      { key: "top_mean_score", label: "Mean score of cases scored 0.7 or more", help: "Three decimals.", value: round(mean(top.map(([s]) => s)), 3), tolerance: 0.002 },
      { key: "top_actual_rate", label: "Share of those cases that really were 1", help: "Three decimals. Compare it with the mean score to judge calibration.", value: round(mean(top.map(([, a]) => a)), 3), tolerance: 0.002 },
    ],
    deliverable: "Report the cheapest threshold and its cost, and the predicted versus actual rate among the high scores.",
  });
}

/** Train and validation accuracy by tree depth: where validation peaks and how far training runs ahead of it. */
export function overfitGap(rng: Rng, texts: Texts): MlDraft {
  const peak = rng.int(4, 7);
  const depths = Array.from({ length: 12 }, (_, i) => i + 1);
  const trainAcc = depths.map((d) => round(Math.min(0.995, 0.7 + 0.027 * d + rng.next() * 0.004), 3));
  const valAcc = depths.map((d) => round(0.79 + 0.01 * rng.next() - 0.004 * (d - peak) ** 2 + (d === peak ? 0.01 : 0), 3));
  const best = valAcc.indexOf(Math.max(...valAcc));
  if (valAcc.filter((v) => v === valAcc[best]).length > 1) throw new MlRejected("tie for the best depth");
  return numbersDraft(texts, {
    skillTags: ["Model evaluation", "Over-fitting", "Model selection"],
    files: [{ name: "depth_results.csv", text: csv(["max_depth", "train_accuracy", "validation_accuracy"], depths.map((d, i) => [d, trainAcc[i], valAcc[i]])) }],
    starter: `import pandas as pd

r = pd.read_csv("depth_results.csv")   # a decision tree trained at each max_depth, scored on its training rows and on held-out rows
`,
    fields: [
      { key: "best_depth", label: "max_depth with the best validation accuracy", value: best + 1, tolerance: 0 },
      { key: "gap_best", label: "Train minus validation accuracy at that depth", help: "Three decimals.", value: round(trainAcc[best] - valAcc[best], 3), tolerance: 0.001 },
      { key: "gap_deepest", label: "Train minus validation accuracy at max_depth 12", help: "Three decimals.", value: round(trainAcc[11] - valAcc[11], 3), tolerance: 0.001 },
    ],
    deliverable: "Report the depth to ship and the train/validation gap there and at the deepest tree.",
  });
}
