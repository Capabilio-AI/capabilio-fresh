import { choices, fmt, gauge, info, objective, rupees } from "../util";
import { defineLab, type Lab, type Outcome, type Settings } from "../types";
import { gridSettings } from "../grid";

// Machine Learning: binary classifier with Gaussian scores. Negatives ~ N(0, 1), positives ~ N(d′, 1). Recall = 1 − Φ(z − d′), FPR = 1 − Φ(z).
interface S { prevalence: number; recallMin: number; precisionMin: number; budget: number }

const Z = Array.from({ length: 21 }, (_, i) => Number((-1 + i * 0.25).toFixed(2)));
const MODEL = [{ v: 1.2, n: "logistic regression" }, { v: 1.8, n: "random forest" }, { v: 2.4, n: "gradient boosting" }, { v: 3, n: "ensemble + extra features" }];
const COST = [4000, 18000, 36000, 90000];
const phi = (x: number) => {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const p = (1 / Math.sqrt(2 * Math.PI)) * Math.exp((-x * x) / 2) * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x >= 0 ? 1 - p : p;
};

function analyse(s: S, st: Settings) {
  const d = Number(st.model);
  const z = Number(st.z);
  const recall = 1 - phi(z - d);
  const fpr = 1 - phi(z);
  const precision = (s.prevalence * recall) / (s.prevalence * recall + (1 - s.prevalence) * fpr || 1);
  return { d, z, recall, fpr, precision, cost: COST[MODEL.findIndex((m) => m.v === d)] ?? 0, roc: (zz: number): [number, number] => [1 - phi(zz), 1 - phi(zz - d)] };
}

const lab: Lab<S> = {
  key: "ml-threshold",
  family: "it",
  format: "simulation",
  name: "Model evaluation bench",
  topic: "Machine Learning · Classification metrics and thresholds",
  keywords: ["machine learning", "artificial intelligence", "data science", "deep learning", "data mining", "analytics"],
  tools: ["Model selector", "Decision threshold", "ROC curve", "Confusion metrics"],
  skillTags: ["Precision and recall", "ROC curve", "Threshold selection"],
  makeScenario(rng, d) {
    const base: S = { prevalence: rng.pick([0.01, 0.02, 0.05, 0.1, 0.2, 0.3]), recallMin: 0, precisionMin: 0, budget: 0 };
    const ref = rng.pick([...gridSettings(lab.controls(base))].filter((st) => { const a = analyse(base, st); return a.recall > 0.5 && a.precision > 0.1; }));
    const a = analyse(base, ref);
    return { ...base, recallMin: Number((a.recall * (d === "easy" ? 0.85 : d === "medium" ? 0.95 : 0.995)).toFixed(3)), precisionMin: Number((a.precision * (d === "easy" ? 0.8 : d === "medium" ? 0.93 : 0.99)).toFixed(3)), budget: Math.max(a.cost, d === "easy" ? 90000 : d === "medium" ? Math.min(90000, a.cost * 2) : a.cost) };
  },
  given: (s) => [{ label: "Positive cases", value: `${fmt(s.prevalence * 100, 0)}% of all cases` }, { label: "Must catch", value: `at least ${fmt(s.recallMin * 100, 1)}% of positives (recall)` }, { label: "Alert quality", value: `at least ${fmt(s.precisionMin * 100, 1)}% of alerts are real (precision)` }, { label: "Training budget", value: `${rupees(s.budget)}` }],
  mission: (s) => `Pick a model and decision threshold with recall ≥ ${fmt(s.recallMin * 100, 1)}% and precision ≥ ${fmt(s.precisionMin * 100, 1)}%, within ${rupees(s.budget)} of training cost.`,
  controls: () => [
    { kind: "choice", id: "model", label: "Model", options: MODEL.map((m, i) => ({ value: String(m.v), label: `${m.n} (${rupees(COST[i])})` })), default: "1.2" },
    { kind: "choice", id: "z", label: "Decision threshold", options: choices(Z), default: "-1" },
  ],
  evaluate(s, st): Outcome {
    const a = analyse(s, st);
    const objectives = [
      objective("rec", `Recall ≥ ${fmt(s.recallMin * 100, 1)}%`, a.recall >= s.recallMin, `${fmt(a.recall * 100, 1)}%`, "A lower threshold flags more cases, catching more positives."),
      objective("pre", `Precision ≥ ${fmt(s.precisionMin * 100, 1)}%`, a.precision >= s.precisionMin, `${fmt(a.precision * 100, 1)}%`, "With rare positives, even a small false-positive rate floods you with false alerts."),
      objective("cost", `Training cost ≤ ${rupees(s.budget)}`, a.cost <= s.budget, rupees(a.cost), "A stronger model separates the classes better, but costs more to build."),
    ];
    const pts: [number, number][] = Array.from({ length: 41 }, (_, i) => a.roc(-3 + i * 0.2));
    return {
      readings: [gauge("rec", "Recall", a.recall * 100, `${fmt(a.recall * 100, 1)}%`, { min: 0, max: 100, low: s.recallMin * 100 }), gauge("pre", "Precision", a.precision * 100, `${fmt(a.precision * 100, 1)}%`, { min: 0, max: 100, low: s.precisionMin * 100 }), info("fpr", "False-positive rate", `${fmt(a.fpr * 100, 1)}%`)],
      objectives,
      passed: objectives.every((o) => o.ok),
      series: { title: "ROC curve of the chosen model", xLabel: "false-positive rate", yLabel: "recall", lines: [{ name: "ROC", pts, style: "main" }, { name: "Random guess", pts: [[0, 0], [1, 1]], style: "ref" }, { name: "Your threshold", pts: [[a.fpr, 0], [a.fpr, a.recall]], style: "limit" }] },
    };
  },
  explain(s, st) {
    const a = analyse(s, st);
    return `At this threshold the model catches ${fmt(a.recall * 100, 1)}% of positives with a false-positive rate of ${fmt(a.fpr * 100, 1)}%. Because only ${fmt(s.prevalence * 100, 0)}% of cases are positive, that false-positive rate means precision is ${fmt(a.precision * 100, 1)}%: accuracy hides this base-rate effect. Moving the threshold slides along the ROC curve; only a better model moves the curve itself.`;
  },
  fallback: (s) => ({ title: `Catch ${fmt(s.recallMin * 100, 0)}% of fraud`, story: `A payments company sees fraud in about ${fmt(s.prevalence * 100, 0)}% of transactions. Investigators can only review so many alerts, so the data scientist must choose both the model and the point at which it raises an alarm.` }),
};
export default defineLab(lab);
