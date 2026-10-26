import type { Rng } from "../rng";
import { CHURN_SPEC, type DatasetSpec } from "../ml/spec";
import { MlRejected, buildEval, buildMath, buildPredict, type MlDraft, type MlTemplate, type Texts } from "../ml/tickets";
import { buildContract, buildModelChoice, buildShadow } from "./deployment";
import { buildFailingSegment, buildSlices } from "./errors";
import { buildImbalance, buildOverfit, buildOverlap } from "./hygiene";

/**
 * AI/ML Engineer (IT-07) tickets added on top of lib/workplace/ml/tickets.ts: three new areas (migration 135) and an easy, fresher-level ticket for the
 * three original areas that only had junior ones. All are graded by the existing ml_workspace tool (predictions vs hidden labels, numbers within a
 * tolerance); nothing here needs a new grader.
 */
export const ML_ENGINEER_AREAS = ["model-deployment", "error-analysis", "training-hygiene"] as const;

const ML_LEAD = { name: "Kavya Iyer", title: "ML Platform Lead" };
const PRODUCT = { name: "Rohan Bhatt", title: "Product Manager, Retention" };
const fixed = (title: string, scenario: string, requester = ML_LEAD): Texts => ({ company: "Nimbus Telecom", title, scenario, requester });
const withRate = (prevalence: number): DatasetSpec => ({ ...CHURN_SPEC, target: { ...CHURN_SPEC.target, prevalence } });

/** A fixed ticket must always build: when the generated rows cannot prove it fair, try again with fresh data. */
const persist = (build: (rng: Rng) => MlDraft) => (rng: Rng): MlDraft => {
  let last: unknown;
  for (let i = 0; i < 6; i++) {
    try {
      return build(rng);
    } catch (e) {
      if (!(e instanceof MlRejected)) throw e;
      last = e;
    }
  }
  throw last;
};

const t = (id: string, title: string, areas: string[], difficulty: MlTemplate["difficulty"], minLevel: MlTemplate["minLevel"], build: (rng: Rng, texts: Texts) => MlDraft, scenario: string, requester = ML_LEAD): MlTemplate => ({
  id, title, areas, difficulty, minLevel, build: persist((rng) => build(rng, fixed(title, scenario, requester))),
});

export const ML_ENGINEER_TEMPLATES: MlTemplate[] = [
  // model deployment basics
  t("mle-contract-validation", "Reject requests that break the serving contract", ["model-deployment"], "easy", "fresher", buildContract,
    "Hi, the churn model's endpoint crashed twice last week on bad input. Before we add validation in front of it, check yesterday's sample of requests against the contract and tell me how many we would have rejected, and why."),
  t("mle-model-budget", "Pick the model that fits the serving budget", ["model-deployment"], "easy", "fresher", buildModelChoice,
    "Hello, the team trained eight candidate churn models. The most accurate one is too slow and too big for the box we serve from. Pick the one we should deploy."),
  t("mle-shadow-promotion", "Should v2 replace the live model?", ["model-deployment"], "medium", "junior", buildShadow,
    "Hi, v2 of the churn model has been running in shadow next to v1 for two weeks: it saw the same requests but its calls were only logged. Compare the two and tell me whether we promote it."),
  // error analysis
  t("mle-store-slices", "Find the store where the model fails", ["error-analysis"], "easy", "fresher", buildSlices,
    "Hi, the model that flags customers at our stores is accurate overall, but one store manager says it is wrong all the time for her customers. Break the results down by store and find out.", PRODUCT),
  t("mle-region-misses", "Where is the model missing the customers we must catch?", ["error-analysis"], "medium", "junior", buildFailingSegment,
    "Hello, recall on the leavers dropped and nobody knows why. I suspect the misses are not spread evenly. Find where they come from and how much fixing that one place would help.", PRODUCT),
  // training hygiene
  t("mle-depth-sweep", "Our tree gets better in training and worse in production", ["training-hygiene"], "easy", "fresher", buildOverfit,
    "Hi, a colleague kept increasing the tree depth because training accuracy kept going up. Here is the sweep with validation accuracy next to it. Tell me which depth to ship and where it started to overfit."),
  t("mle-class-weights", "Size up the imbalance before training", ["training-hygiene"], "easy", "fresher", buildImbalance,
    "Hello, only a small share of these customers leave, and a model that says 'nobody leaves' already looks accurate. Before training, work out how lopsided the label is and the class weights we should use."),
  t("mle-train-test-overlap", "The test score is too good to be true", ["training-hygiene"], "medium", "junior", buildOverlap,
    "Hi, our new churn model scores far better on the test file than any model before it. I think some customers ended up in both files. Measure how bad it is and how many test customers are really unseen."),
  // easy, fresher-level tickets for the original areas
  t("mle-leakage-easy", "Fix: the churn model is perfect on history and wrong on new customers", ["pipeline-debugging"], "easy", "fresher", (rng, texts) => buildPredict(withRate(0.42), rng, "easy", texts, { leak: true }),
    "Hi, the model below scores almost perfectly on past customers but its calls on new ones are no better than a guess. Find what is wrong in the pipeline and give me predictions I can trust."),
  t("mle-eval-confusion", "Count what the churn model really gets right", ["evaluation"], "easy", "fresher", (rng, texts) => buildEval(CHURN_SPEC, rng, texts),
    "Hi, I'm new to reading model results.", PRODUCT),
  t("mle-zscores", "Standardise a feature by hand", ["ml-fundamentals"], "easy", "fresher", (rng, texts) => buildMath("z_scores", rng, texts),
    "Hi, before we scale every feature with StandardScaler I want to be sure you know what it does. Work out the numbers below by hand in NumPy."),
];
