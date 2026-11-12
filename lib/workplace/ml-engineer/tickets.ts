import type { Rng } from "../rng";
import { CHURN_SPEC, type DatasetSpec } from "../ml/spec";
import { MlRejected, buildEval, buildMath, buildPredict, type MlDraft, type MlTemplate, type Texts } from "../ml/tickets";
import { buildContract, buildModelChoice, buildShadow } from "./deployment";
import { buildFailingSegment, buildSlices } from "./errors";
import { buildImbalance, buildOverfit, buildOverlap } from "./hygiene";
import { buildDateFeatures, buildRareCategories, buildRatioFeatures, buildTargetEncoding } from "./features";
import { buildPickByValidation, buildReproAudit, buildSeedVariance } from "./tracking";
import { buildPsi, buildRollingAlert } from "./monitoring";
import { buildBackpropStep, buildForwardPass } from "./neural";
import { buildCvComparison, buildGridSearch, buildKmeansElbow, buildPcaVariance, buildRocAuc } from "./selection";

/**
 * AI/ML Engineer (IT-07) tickets added on top of lib/workplace/ml/tickets.ts: three new areas (migration 135) and four more (migration 191: feature engineering,
 * experiment tracking, drift monitoring and neural-network basics) and an easy, fresher-level ticket for the
 * three original areas that only had junior ones. All are graded by the existing ml_workspace tool (predictions vs hidden labels, numbers within a
 * tolerance); nothing here needs a new grader.
 */
export const ML_ENGINEER_AREAS = ["model-deployment", "error-analysis", "training-hygiene", "ml-feature-engineering", "experiment-tracking", "drift-monitoring", "neural-networks", "mle-algorithm-selection"] as const;

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

  // feature engineering
  t("mle-ratio-features", "Compare customers per active month, not in total", ["ml-feature-engineering"], "easy", "fresher", buildRatioFeatures,
    "Hi, support tickets and spend both grow the longer someone has been with us, so the raw totals just tell me who is old. Build per-month features and tell me whether customers who leave really raise more tickets.", PRODUCT),
  t("mle-rare-cities", "Too many cities for one-hot encoding", ["ml-feature-engineering"], "easy", "fresher", buildRareCategories,
    "Hello, one-hot encoding the city column gives us a column for every tiny town and the model is memorising them. Group the rare cities and tell me what the encoded table would look like."),
  t("mle-date-features", "Turn order timestamps into model features", ["ml-feature-engineering"], "medium", "junior", buildDateFeatures,
    "Hi, the model only sees one row per customer, but the raw data is a list of order timestamps. Build the weekend, night and recency features from it so we can add them to the training table.", PRODUCT),
  t("mle-target-encoding", "Target encoding that does not leak the label", ["ml-feature-engineering"], "medium", "junior", buildTargetEncoding,
    "Hello, a teammate target-encoded city and the validation score jumped. I suspect the encoding is peeking at each row's own label. Compute the plain and the leave-one-out versions so we can see the difference."),
  // experiment tracking
  t("mle-pick-by-validation", "Which run do we promote?", ["experiment-tracking"], "easy", "fresher", buildPickByValidation,
    "Hi, here is the log of last week's training runs. One of them has a great test score and I am tempted to ship it. Tell me which run we should promote and why that is not the one with the best test score."),
  t("mle-repro-audit", "Which runs can we actually reproduce?", ["experiment-tracking"], "medium", "junior", buildReproAudit,
    "Hello, an auditor asked us to re-create the production model and we could not find its seed. Go through the runs log, tell me which runs are reproducible, and which one we can safely stand behind."),
  t("mle-seed-variance", "Is B really better than A?", ["experiment-tracking"], "medium", "junior", buildSeedVariance,
    "Hi, the new configuration B scored higher than A on one run and the team wants to switch. We trained both with several seeds. Tell me whether the gain is more than the noise between seeds."),
  // drift monitoring
  t("mle-feature-drift", "Which inputs have drifted since training?", ["drift-monitoring"], "easy", "fresher", buildPsi,
    "Hi, the churn model's precision has been slipping and I suspect last week's customers do not look like the ones we trained on. Compare the input distributions and tell me which features have drifted."),
  t("mle-rolling-recall-alert", "When should the recall alert have fired?", ["drift-monitoring"], "easy", "fresher", buildRollingAlert,
    "Hello, we only noticed the model was missing leavers when a manager complained. Replay the daily log against our alert rule and tell me when it would have fired and how bad it got.", PRODUCT),
  // neural-network basics
  t("mle-nn-forward", "Run a tiny network by hand", ["neural-networks"], "easy", "fresher", buildForwardPass,
    "Hi, before we trust a deep-learning library I want to be sure you can compute what it does. Here is a very small network with its weights. Run it forward and compute the loss."),
  t("mle-nn-backprop", "Take one backpropagation step by hand", ["neural-networks"], "medium", "junior", buildBackpropStep,
    "Hello, to review the training code I need you to show you understand what the optimiser does to the weights. Work out one gradient step for this single-neuron-deep network."),
  // algorithm selection and tuning
  t("mle-cv-comparison", "Which of the five models do we use?", ["mle-algorithm-selection"], "easy", "fresher", buildCvComparison,
    "Hi, we cross-validated five algorithms on the churn data and I need to pick one. Tell me which has the best average, which is the most stable, and whether the winner is clearly ahead or just lucky."),
  t("mle-grid-search", "Pick the settings from the grid search", ["mle-algorithm-selection"], "easy", "fresher", buildGridSearch,
    "Hello, a colleague ran a grid search on the SVM and is about to use the setting with the best training accuracy. Read the grid, tell me which setting to use, and how many settings are overfitting."),
  t("mle-kmeans-elbow", "How many customer segments should we use?", ["mle-algorithm-selection"], "medium", "junior", buildKmeansElbow,
    "Hi, marketing wants customer segments from k-means and keeps asking how many there should be. Use the elbow method on our inertia results and tell me what you would choose.", PRODUCT),
  t("mle-roc-auc", "How good is the ranking, apart from any threshold?", ["mle-algorithm-selection"], "medium", "fresher", buildRocAuc,
    "Hello, accuracy depends on the cut-off we pick, and nobody has settled that yet. Compute the ROC-AUC from the model's scores, and show what the model does at a 0.5 cut-off."),
  t("mle-pca-variance", "How many components do we keep?", ["mle-algorithm-selection"], "medium", "junior", buildPcaVariance,
    "Hi, we have many correlated features and want to reduce them with PCA without losing much information. From the eigenvalues, tell me how many components keep at least 90% of the variance."),
];
