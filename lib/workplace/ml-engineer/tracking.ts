import type { Rng } from "../rng";
import { MAX_SUBMISSIONS, MlRejected, type MlDraft, type Texts } from "../ml/tickets";
import { csv } from "../ml/world";

// Experiment tracking, as numbers the notebook can produce from a runs log: pick the run on validation (never on the test score), keep only runs
// that can be reproduced, and decide whether a gain is bigger than the noise between seeds. Every answer is computed here from the generated rows.

const round = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;
const mean = (xs: readonly number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
const sampleStd = (xs: readonly number[]) => {
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1));
};
const f3 = (v: number) => round(v, 3);
const MODELS = ["logreg", "random_forest", "gbm", "svm"];

const RUNS = 14;

/** Choose the run to promote from a log: highest validation F1; the run with the best test F1 is the trap. */
export function buildPickByValidation(rng: Rng, texts: Texts): MlDraft {
  const vals = rng.shuffle(Array.from({ length: 60 }, (_, i) => 640 + i * 3)).slice(0, RUNS).map((v) => v / 1000);
  const runs = vals.map((val, i) => ({ id: 101 + i, model: rng.pick(MODELS), seed: rng.int(1, 999), val, test: f3(val + (rng.next() - 0.55) * 0.05) }));
  const bestVal = [...runs].sort((a, b) => b.val - a.val)[0];
  // the log always holds a trap: another run whose test score is the highest, which is not the run to promote
  const trap = rng.pick(runs.filter((r) => r.id !== bestVal.id));
  trap.test = f3(Math.max(...runs.map((r) => r.test)) + 0.004 + rng.next() * 0.01);
  const bestTest = trap;
  const ties = new Set(runs.map((r) => r.test)).size !== runs.length;
  if (ties) throw new MlRejected("tied test scores");
  return {
    title: texts.title, requester: texts.requester, scenario: texts.scenario,
    skillTags: ["Experiment tracking", "Model selection", "Validation vs test"],
    content: {
      company: texts.company, kind: "numbers",
      files: [{ name: "runs.csv", text: csv(["run_id", "model", "seed", "val_f1", "test_f1"], runs.map((r) => [r.id, r.model, r.seed, r.val, r.test])) }],
      starter: `import pandas as pd

runs = pd.read_csv("runs.csv")
# val_f1 is the score on the validation split used while tuning.
# test_f1 is the held-out score: it is for reporting the final model, never for choosing it.
`,
      fields: [
        { key: "chosen_run", label: "run_id to promote", help: "The run with the highest val_f1." },
        { key: "chosen_val", label: "Its val_f1", help: "Three decimals." },
        { key: "chosen_test", label: "Its test_f1", help: "Three decimals." },
        { key: "trap_run", label: "run_id with the highest test_f1", help: "The run you must not pick because of its test score." },
        { key: "selection_gap", label: "test_f1 of the trap run minus test_f1 of the chosen run", help: "Three decimals." },
      ],
      maxSubmissions: MAX_SUBMISSIONS, deliverable: "Choose the run the right way and report the five numbers.",
    },
    key: { kind: "numbers", expected: { chosen_run: bestVal.id, chosen_val: bestVal.val, chosen_test: bestVal.test, trap_run: bestTest.id, selection_gap: f3(bestTest.test - bestVal.test) }, tolerance: { chosen_run: 0, chosen_val: 0.0005, chosen_test: 0.0005, trap_run: 0, selection_gap: 0.0015 } },
  };
}

/** A run can be reproduced only if its seed, code version and data version were all recorded; the best run overall is not one of them. */
export function buildReproAudit(rng: Rng, texts: Texts): MlDraft {
  const vals = rng.shuffle(Array.from({ length: 40 }, (_, i) => 700 + i * 4)).slice(0, 16).map((v) => v / 1000);
  const runs = vals.map((val, i) => {
    const gap = rng.chance(0.4);
    const miss = gap ? rng.pick(["seed", "git_sha", "data_version", "all"]) : null;
    return {
      id: 201 + i, val,
      seed: miss === "seed" || miss === "all" ? "" : String(rng.int(1, 999)),
      sha: miss === "git_sha" || miss === "all" ? "" : rng.int(0x100000, 0xffffff).toString(16),
      data: miss === "data_version" || miss === "all" ? "" : `v${rng.int(1, 4)}`,
    };
  });
  const bestAll = [...runs].sort((a, b) => b.val - a.val)[0];
  bestAll.seed = ""; // the best run overall is never reproducible: that is the point of the audit
  const ok = runs.filter((r) => r.seed && r.sha && r.data);
  if (ok.length < 4 || ok.length > runs.length - 4) throw new MlRejected("not a fair split of reproducible runs");
  const bestOk = [...ok].sort((a, b) => b.val - a.val)[0];
  return {
    title: texts.title, requester: texts.requester, scenario: texts.scenario,
    skillTags: ["Experiment tracking", "Reproducibility", "pandas"],
    content: {
      company: texts.company, kind: "numbers",
      files: [{ name: "runs.csv", text: csv(["run_id", "val_f1", "seed", "git_sha", "data_version"], runs.map((r) => [r.id, r.val, r.seed, r.sha, r.data])) }],
      starter: `import pandas as pd

runs = pd.read_csv("runs.csv", keep_default_na=False)   # an empty cell stays as ""
# a run is reproducible only if seed, git_sha and data_version are all filled in
`,
      fields: [
        { key: "reproducible", label: "Reproducible runs" },
        { key: "unreproducible", label: "Runs that cannot be reproduced" },
        { key: "best_run", label: "run_id of the best reproducible run", help: "Highest val_f1 among the reproducible runs." },
        { key: "best_val", label: "Its val_f1", help: "Three decimals." },
        { key: "lost_score", label: "val_f1 of the best run overall minus the best reproducible run", help: "What insisting on reproducibility costs. Three decimals." },
      ],
      maxSubmissions: MAX_SUBMISSIONS, deliverable: "Audit the log and report the five numbers.",
    },
    key: { kind: "numbers", expected: { reproducible: ok.length, unreproducible: runs.length - ok.length, best_run: bestOk.id, best_val: bestOk.val, lost_score: f3(bestAll.val - bestOk.val) }, tolerance: { reproducible: 0, unreproducible: 0, best_run: 0, best_val: 0.0005, lost_score: 0.0015 } },
  };
}

const SEEDS = 5;
const SIGMAS = 2;

/** Is configuration B really better, or is the gain inside the noise between seeds? */
export function buildSeedVariance(rng: Rng, texts: Texts): MlDraft {
  const baseA = 0.74 + rng.next() * 0.06;
  const spread = 0.006 + rng.next() * 0.02;
  const lift = (rng.next() - 0.2) * 0.05;
  const a = Array.from({ length: SEEDS }, () => f3(baseA + (rng.next() - 0.5) * 2 * spread));
  const b = Array.from({ length: SEEDS }, () => f3(baseA + lift + (rng.next() - 0.5) * 2 * spread));
  const [ma, mb, sa, sb] = [mean(a), mean(b), sampleStd(a), sampleStd(b)];
  const bar = SIGMAS * Math.max(sa, sb);
  if (Math.abs(mb - ma - bar) < 0.003) throw new MlRejected("the adoption rule sits on a knife edge");
  const rows = [...a.map((v, i) => ["A", i + 1, v] as const), ...b.map((v, i) => ["B", i + 1, v] as const)];
  return {
    title: texts.title, requester: texts.requester, scenario: `${texts.scenario} Our rule: adopt B only if its mean val_f1 beats A's by more than ${SIGMAS} times the larger of the two standard deviations.`,
    skillTags: ["Experiment tracking", "Noise between seeds", "Statistics"],
    content: {
      company: texts.company, kind: "numbers",
      files: [{ name: "seeds.csv", text: csv(["config", "seed_no", "val_f1"], rows) }],
      starter: `import pandas as pd

s = pd.read_csv("seeds.csv")   # the same two configurations, each trained with ${SEEDS} different random seeds
# use the sample standard deviation (ddof=1, the pandas default)
`,
      fields: [
        { key: "mean_a", label: "Mean val_f1 of A", help: "Four decimals." },
        { key: "mean_b", label: "Mean val_f1 of B", help: "Four decimals." },
        { key: "std_a", label: "Standard deviation of A", help: "Four decimals." },
        { key: "std_b", label: "Standard deviation of B", help: "Four decimals." },
        { key: "adopt_b", label: "Adopt B? 1 = yes, 0 = no" },
      ],
      maxSubmissions: MAX_SUBMISSIONS, deliverable: "Compare the two configurations across seeds and make the call.",
    },
    key: { kind: "numbers", expected: { mean_a: round(ma, 4), mean_b: round(mb, 4), std_a: round(sa, 4), std_b: round(sb, 4), adopt_b: mb - ma > bar ? 1 : 0 }, tolerance: { mean_a: 0.0003, mean_b: 0.0003, std_a: 0.0004, std_b: 0.0004, adopt_b: 0 } },
  };
}
