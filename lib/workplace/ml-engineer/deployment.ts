import type { Rng } from "../rng";
import { confusion, precision, recall } from "../ml/metrics";
import { MAX_SUBMISSIONS, MlRejected, type MlDraft, type Texts } from "../ml/tickets";
import { csv } from "../ml/world";

// Model deployment basics, as numbers the notebook can produce: does a request meet the serving contract, which model fits the latency and size
// budget, and is the new version better than the live one in shadow. Every answer is computed here from the generated rows.

const round = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;
const PLANS = ["basic", "plus", "pro"] as const;
const TENURE = { min: 1, max: 60 };
const SPEND = { min: 150, max: 900 };
const REQUESTS = 80;
const PER_PROBLEM = { min: 3, max: 7 };

type Problem = "missing" | "range" | "category";

/** One request; a bad request breaks the contract in exactly one way, so the three counts never overlap. */
function request(rng: Rng, id: number, problem: Problem | null): (string | number | null)[] {
  const tenure: number | null = rng.int(TENURE.min, TENURE.max);
  const spend: number | null = round(SPEND.min + rng.next() * (SPEND.max - SPEND.min), 2);
  const plan: string | null = rng.pick(PLANS);
  if (problem === "missing") {
    const which = rng.int(0, 2);
    return [id, which === 0 ? null : tenure, which === 1 ? null : spend, which === 2 ? null : plan];
  }
  if (problem === "range") return rng.chance(0.5) ? [id, rng.pick([0, -3, 61, 120]), spend, plan] : [id, tenure, rng.pick([0, 99.5, 1250, 4800]), plan];
  if (problem === "category") return [id, tenure, spend, rng.pick(["PRO", "Basic", "gold", "premium", "plus "])];
  return [id, tenure, spend, plan];
}

/** Count the requests the serving layer must reject under a written contract. */
export function buildContract(rng: Rng, texts: Texts): MlDraft {
  const counts = { missing: rng.int(PER_PROBLEM.min, PER_PROBLEM.max), range: rng.int(PER_PROBLEM.min, PER_PROBLEM.max), category: rng.int(PER_PROBLEM.min, PER_PROBLEM.max) };
  const problems: (Problem | null)[] = rng.shuffle([
    ...Array<Problem>(counts.missing).fill("missing"),
    ...Array<Problem>(counts.range).fill("range"),
    ...Array<Problem>(counts.category).fill("category"),
    ...Array<null>(REQUESTS - counts.missing - counts.range - counts.category).fill(null),
  ]);
  const rows = problems.map((p, i) => request(rng, 5001 + i, p));
  const invalid = counts.missing + counts.range + counts.category;
  return {
    title: texts.title, requester: texts.requester, scenario: texts.scenario,
    skillTags: ["Model serving", "Input validation", "pandas"],
    content: {
      company: texts.company, kind: "numbers",
      files: [{ name: "requests.csv", text: csv(["request_id", "tenure_months", "monthly_spend", "plan"], rows) }],
      starter: `import pandas as pd

requests = pd.read_csv("requests.csv", keep_default_na=False)   # empty cells stay as ""

# the serving contract: every field is required
contract = {
    "tenure_months": {"type": "int", "min": ${TENURE.min}, "max": ${TENURE.max}},
    "monthly_spend": {"type": "float", "min": ${SPEND.min}, "max": ${SPEND.max}},
    "plan": {"allowed": ${JSON.stringify(PLANS)}},   # exact values only, no other spelling or spaces
}
# a request that breaks any rule is rejected before it reaches the model
`,
      fields: [
        { key: "invalid", label: "Requests that must be rejected" },
        { key: "missing", label: "Rejected because a required field is empty" },
        { key: "out_of_range", label: "Rejected because a number is outside its range", help: "The limits are inclusive." },
        { key: "bad_category", label: "Rejected because plan is not an allowed value" },
      ],
      maxSubmissions: MAX_SUBMISSIONS, deliverable: "Check every request against the contract and report the four counts.",
    },
    key: { kind: "numbers", expected: { invalid, missing: counts.missing, out_of_range: counts.range, bad_category: counts.category }, tolerance: { invalid: 0, missing: 0, out_of_range: 0, bad_category: 0 } },
  };
}

const CANDIDATES = 8;
const CHOICE_TRIES = 20;

/** Pick the most accurate candidate that fits a latency and size budget; the most accurate model overall never fits. */
export function buildModelChoice(rng: Rng, texts: Texts): MlDraft {
  for (let attempt = 0; attempt < CHOICE_TRIES; attempt++) {
    const accs = rng.shuffle(Array.from({ length: 151 }, (_, i) => 800 + i)).slice(0, CANDIDATES).map((a) => a / 1000);
    const models = accs.map((acc, i) => ({
      id: i + 1,
      version: `v${rng.int(1, 4)}.${rng.int(0, 9)}`,
      acc,
      latency: Math.round(15 + (acc - 0.8) * 1400 + rng.int(0, 70)),
      size: Math.round(8 + (acc - 0.8) * 1800 + rng.int(0, 90)),
    }));
    const latencyLimit = rng.pick([80, 100, 120, 150]);
    const sizeLimit = rng.pick([120, 150, 200]);
    const fits = models.filter((m) => m.latency <= latencyLimit && m.size <= sizeLimit);
    const best = [...models].sort((a, b) => b.acc - a.acc)[0];
    if (fits.length < 2 || fits.includes(best)) continue;
    const chosen = [...fits].sort((a, b) => b.acc - a.acc)[0];
    return {
      title: texts.title, requester: texts.requester,
      scenario: `${texts.scenario} The serving budget is a p95 latency of at most ${latencyLimit} ms and a model file of at most ${sizeLimit} MB.`,
      skillTags: ["Model deployment", "Latency and size trade-offs", "Model selection"],
      content: {
        company: texts.company, kind: "numbers",
        files: [{ name: "candidates.csv", text: csv(["model_id", "version", "val_accuracy", "p95_latency_ms", "size_mb"], models.map((m) => [m.id, m.version, m.acc, m.latency, m.size])) }],
        starter: `import pandas as pd

c = pd.read_csv("candidates.csv")
LATENCY_LIMIT_MS = ${latencyLimit}   # p95, inclusive
SIZE_LIMIT_MB = ${sizeLimit}         # inclusive
`,
        fields: [
          { key: "model_id", label: "model_id of the model to deploy", help: "The most accurate model that meets BOTH limits." },
          { key: "accuracy", label: "Its validation accuracy", help: "Three decimals." },
          { key: "given_up", label: "Accuracy given up against the most accurate model overall", help: "Three decimals." },
          { key: "fit_count", label: "How many candidates meet both limits" },
        ],
        maxSubmissions: MAX_SUBMISSIONS, deliverable: "Choose the model to deploy under the budget and report the four numbers.",
      },
      key: { kind: "numbers", expected: { model_id: chosen.id, accuracy: chosen.acc, given_up: round(best.acc - chosen.acc, 3), fit_count: fits.length }, tolerance: { model_id: 0, accuracy: 0.0005, given_up: 0.0005, fit_count: 0 } },
    };
  }
  throw new MlRejected("no candidate set with a clear choice");
}

const SHADOW_ROWS = 400;
const PRECISION_FLOOR = 0.6;

/** v2 ran in shadow next to the live v1; read the log and apply the promotion rule. */
export function buildShadow(rng: Rng, texts: Texts): MlDraft {
  const actual = Array.from({ length: SHADOW_ROWS }, () => (rng.chance(0.18) ? 1 : 0));
  const hit1 = 0.5 + rng.next() * 0.15;
  const hit2 = hit1 + (rng.next() - 0.3) * 0.25;
  const false2 = rng.pick([0.04, 0.07, 0.12]);
  const v1 = actual.map((a) => (a ? (rng.chance(hit1) ? 1 : 0) : rng.chance(0.05) ? 1 : 0));
  const v2 = actual.map((a) => (a ? (rng.chance(hit2) ? 1 : 0) : rng.chance(false2) ? 1 : 0));
  const c1 = confusion(actual, v1);
  const c2 = confusion(actual, v2);
  if (c1.tp === 0 || c2.tp === 0) throw new MlRejected("degenerate shadow log");
  const r1 = round(recall(c1), 3);
  const r2 = round(recall(c2), 3);
  const p2 = round(precision(c2), 3);
  if (r1 === r2 || Math.abs(p2 - PRECISION_FLOOR) < 0.005) throw new MlRejected("the promotion rule sits on a knife edge");
  const disagree = v1.filter((p, i) => p !== v2[i]).length / SHADOW_ROWS;
  return {
    title: texts.title, requester: texts.requester,
    scenario: `${texts.scenario} Our rule: promote v2 only if its recall is higher than v1's AND its precision is at least ${PRECISION_FLOOR.toFixed(2)}.`,
    skillTags: ["Model versioning", "Shadow deployment", "Precision and recall"],
    content: {
      company: texts.company, kind: "numbers",
      files: [{ name: "shadow_log.csv", text: csv(["actual", "v1_live", "v2_shadow"], actual.map((a, i) => [a, v1[i], v2[i]])) }],
      starter: `import pandas as pd

log = pd.read_csv("shadow_log.csv")   # actual: what happened; v1_live / v2_shadow: each version's call on the same request
`,
      fields: [
        { key: "v1_recall", label: "Recall of v1 (live)", help: "Three decimals." },
        { key: "v2_recall", label: "Recall of v2 (shadow)", help: "Three decimals." },
        { key: "v2_precision", label: "Precision of v2", help: "Three decimals." },
        { key: "disagree", label: "Share of requests where v1 and v2 disagree", help: "Three decimals." },
        { key: "promote", label: "Promote v2? 1 = yes, 0 = no" },
      ],
      maxSubmissions: MAX_SUBMISSIONS, deliverable: "Compare the two versions on the shadow log and make the promotion call.",
    },
    key: { kind: "numbers", expected: { v1_recall: r1, v2_recall: r2, v2_precision: p2, disagree: round(disagree, 3), promote: r2 > r1 && p2 >= PRECISION_FLOOR ? 1 : 0 }, tolerance: { v1_recall: 0.002, v2_recall: 0.002, v2_precision: 0.002, disagree: 0.002, promote: 0 } },
  };
}
