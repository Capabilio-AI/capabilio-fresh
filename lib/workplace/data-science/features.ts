import type { Rng } from "../rng";
import { MlRejected, type MlDraft, type Texts } from "../ml/tickets";
import { csv } from "../ml/world";
import { mean, normal, numbersDraft, round } from "./numbers";

/** Feature-engineering tickets: encode, transform and scale features, and learn the transform from the training rows only. */

const CITIES = ["pune", "nagpur", "kochi", "indore", "surat", "mysuru", "bhopal"];
const EMPLOYMENT = ["salaried", "self_employed", "student"];

/** One-hot width, a log transform for a skewed column and a threshold count, on a loan-applicant table. */
export function encodeAndTransform(rng: Rng, texts: Texts): MlDraft {
  const cities = rng.shuffle(CITIES).slice(0, rng.int(4, 6));
  const rows = Array.from({ length: 300 }, (_, i) => [
    i + 1,
    rng.int(21, 60),
    Math.round((12000 + 188000 * rng.next() ** 3) / 100) * 100,
    rng.pick(cities),
    rng.weighted(EMPLOYMENT.map((e, j) => [e, [6, 3, 1][j]] as const)),
  ]);
  const incomes = rows.map((r) => r[2] as number);
  const dummies = new Set(rows.map((r) => r[3])).size + new Set(rows.map((r) => r[4])).size;
  const high = incomes.filter((v) => v >= 100000).length;
  if (high === 0) throw new MlRejected("no high incomes");
  return numbersDraft(texts, {
    skillTags: ["Feature engineering", "One-hot encoding", "Log transform", "pandas"],
    files: [{ name: "applicants.csv", text: csv(["applicant_id", "age", "monthly_income", "city", "employment"], rows) }],
    starter: `import pandas as pd
import numpy as np

df = pd.read_csv("applicants.csv")
# 1. one-hot encode "city" and "employment" with pd.get_dummies (keep every level, no drop_first)
# 2. monthly_income is skewed: make log_income = np.log1p(monthly_income)
# 3. flag high earners: monthly_income >= 100000
`,
    fields: [
      { key: "dummy_columns", label: "New columns the one-hot encoding creates for city and employment together", value: dummies, tolerance: 0 },
      { key: "mean_log_income", label: "Mean of log_income", help: "Natural log of (1 + income). Three decimals.", value: round(mean(incomes.map(Math.log1p)), 3), tolerance: 0.002 },
      { key: "high_income_rows", label: "Applicants flagged as high earners", value: high, tolerance: 0 },
    ],
    deliverable: "Report the number of one-hot columns, the mean of the log-transformed income and the number of high earners.",
  });
}

/**
 * Scaling and target encoding learnt from train.csv alone. The new batch spends more than the history, so fitting the scaler (or the encoding) on all
 * rows gives numbers that are clearly off: that is the leak the ticket checks for.
 */
export function trainOnlyScaling(rng: Rng, texts: Texts): MlDraft {
  const plans = ["basic", "plus", "pro"] as const;
  const renewP = { basic: 0.45 + rng.next() * 0.1, plus: 0.6 + rng.next() * 0.1, pro: 0.75 + rng.next() * 0.1 };
  const spend = (shift: number) => Math.max(100, round(600 + shift + 150 * normal(rng), 2));
  const train = Array.from({ length: 400 }, (_, i) => {
    const plan = rng.weighted(plans.map((p, j) => [p, [5, 3, 2][j]] as const));
    return [i + 1, plan, spend(0), rng.chance(renewP[plan]) ? 1 : 0];
  });
  const test = Array.from({ length: 150 }, (_, i) => [401 + i, rng.weighted(plans.map((p, j) => [p, [5, 3, 2][j]] as const)), spend(90)]);
  const xs = train.map((r) => r[2] as number);
  const m = mean(xs);
  const sd = Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
  const basic = train.filter((r) => r[1] === "basic");
  if (basic.length < 30) throw new MlRejected("too few basic-plan rows");
  return numbersDraft(texts, {
    skillTags: ["Feature engineering", "Feature scaling", "Target encoding", "Data leakage"],
    files: [
      { name: "train.csv", text: csv(["customer_id", "plan", "monthly_spend", "renewed"], train) },
      { name: "test.csv", text: csv(["customer_id", "plan", "monthly_spend"], test) },
    ],
    starter: `import pandas as pd
from sklearn.preprocessing import StandardScaler

train = pd.read_csv("train.csv")
test = pd.read_csv("test.csv")
# standardise monthly_spend the way the model will see it in production, and
# encode "plan" as the renewal rate of that plan (target encoding)
`,
    fields: [
      { key: "train_mean", label: "Mean of monthly_spend the scaler should use", help: "Two decimals.", value: round(m, 2), tolerance: 0.01 },
      { key: "train_std", label: "Standard deviation the scaler should use", help: "As StandardScaler computes it (divide by n). Two decimals.", value: round(sd, 2), tolerance: 0.01 },
      { key: "first_test_scaled", label: "Scaled monthly_spend of the first row of test.csv", help: "Three decimals.", value: round(((test[0][2] as number) - m) / sd, 3), tolerance: 0.002 },
      { key: "basic_rate", label: "Target encoding for the basic plan", help: "Share of basic-plan customers who renewed. Three decimals.", value: round(mean(basic.map((r) => r[3] as number)), 3), tolerance: 0.002 },
    ],
    deliverable: "Report the scaler's mean and standard deviation, the scaled value of the first new customer and the encoding of the basic plan.",
  });
}
