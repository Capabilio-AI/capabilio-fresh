import { buildPredict, type MlTemplate, type Texts } from "../ml/tickets";
import { DatasetSpecSchema } from "../ml/spec";
import { abSignificance, multipleComparisons, sampleSize, simpsons } from "./experiment";
import { encodeAndTransform, trainOnlyScaling } from "./features";
import { costAndCalibration, overfitGap, thresholdMetrics } from "./evaluation";
import { persist } from "./numbers";

/**
 * The Data Scientist's notebook tickets, served by ml_workspace (lib/arena-workstations/tools/ml.ts) for the four areas below. They are fixed templates
 * on fresh random data; the AI scenario generator in lib/workplace/ml/ai.ts knows only the AI/ML Engineer's areas, so ml.ts must skip it for these.
 */
export const DATA_SCIENCE_ML_AREAS: readonly string[] = ["experiment-design", "feature-engineering", "model-building", "model-evaluation"];
export const isDataScienceMlArea = (areaKey: string | undefined): boolean => !!areaKey && DATA_SCIENCE_ML_AREAS.includes(areaKey);

/** An online-learning platform: will a learner finish the course? Balanced outcome, scored on accuracy. */
const COURSE_SPEC = DatasetSpecSchema.parse({
  entity: "learner",
  id_column: "learner_id",
  target: { name: "completed", positive_meaning: "the learner completed the course", prevalence: 0.42 },
  features: [
    { name: "weekly_hours", kind: "float", min: 0, max: 15, effect: 2.4 },
    { name: "videos_watched_pct", kind: "int", min: 0, max: 100, effect: 1.8, missing: 0.05 },
    { name: "quizzes_attempted", kind: "int", min: 0, max: 12, effect: 1.3 },
    { name: "days_since_signup", kind: "int", min: 1, max: 120, effect: -0.4 },
    { name: "device", kind: "category", categories: [{ value: "laptop", weight: 45, effect: 0.5 }, { value: "mobile", weight: 45, effect: -0.4 }, { value: "tablet", weight: 10, effect: 0 }] },
    { name: "city_tier", kind: "category", categories: [{ value: "tier1", weight: 40, effect: 0.1 }, { value: "tier2", weight: 35, effect: 0 }, { value: "tier3", weight: 25, effect: -0.1 }] },
  ],
});

/** A small-loans lender: will a borrower default? Rare outcome, scored on F1, with a column recorded only after default (the leak). */
const DEFAULT_SPEC = DatasetSpecSchema.parse({
  entity: "borrower",
  id_column: "loan_id",
  target: { name: "defaulted", positive_meaning: "the borrower defaulted", prevalence: 0.16 },
  features: [
    { name: "loan_amount", kind: "float", min: 20000, max: 500000, skew: "right", effect: 0.9 },
    { name: "monthly_income", kind: "float", min: 15000, max: 200000, skew: "right", effect: -2.0, missing: 0.06 },
    { name: "missed_emis_last_year", kind: "int", min: 0, max: 6, effect: 2.6 },
    { name: "credit_history_months", kind: "int", min: 0, max: 120, effect: -1.3 },
    { name: "employment", kind: "category", categories: [{ value: "salaried", weight: 55, effect: -0.4 }, { value: "self_employed", weight: 30, effect: 0.3 }, { value: "contract", weight: 15, effect: 0.7 }] },
    { name: "region", kind: "category", categories: ["north", "south", "east", "west"].map((value) => ({ value, weight: 25, effect: 0 })) },
  ],
  leak: { name: "recovery_agent_assigned", description: "a recovery agent assigned after the borrower had already defaulted" },
});

const GROWTH = { name: "Nikhil Bansal", title: "Growth Product Manager" };
const RISK = { name: "Farah Siddiqui", title: "Head of Credit Risk" };
const LEARNING = { name: "Kavya Reddy", title: "Learner Success Lead" };
const texts = (company: string, requester: Texts["requester"], title: string, scenario: string): Texts => ({ company, requester, title, scenario });
const SHOP = (title: string, scenario: string) => texts("Kesar Lane Mart", GROWTH, title, scenario);
const LENDER = (title: string, scenario: string) => texts("Tarangi Credit", RISK, title, scenario);
const COURSES = (title: string, scenario: string) => texts("Gurukosh Learning", LEARNING, title, scenario);

const T = {
  ab: SHOP("Did the new checkout button really lift conversion?", "Hi, we ran the new one-tap checkout (B) against the current page (A) for two weeks. The dashboard shows B ahead, but I have been burnt by noise before. Please test it properly and tell me if I can call it."),
  power: SHOP("How long must the free-delivery test run?", "Hello, before we switch on the free-delivery banner test I need to tell leadership how long it will take. We only care if it lifts conversion by at least the amount below; size the test so we would catch that 80% of the time."),
  many: SHOP("Five new banners: which ones really won?", "Hi, design tested five home-page banners against the current one at once. Several look like winners on the 5% rule, but with so many comparisons some will be flukes. Tell me how many really hold up."),
  simpson: SHOP("B lost overall but the team swears it is better", "Hello, the new product page (B) converts worse than the old one (A) overall, but the team says it is better on every device. Traffic was not split evenly between devices. Work out what is really going on before we bin it."),
  encode: LENDER("Prepare applicant features for the risk model", "Hi, the applicant table goes into the risk model next week. The model needs numbers only, income is heavily skewed, and the credit team wants a flag for high earners. Prepare the features and give me a few numbers to check your work."),
  scaling: LENDER("Scale features the way production will see them", "Hello, our last model looked great offline and drifted on day one because someone fitted the scaler on everything, new customers included. Here is the history the model trains on and a batch of new customers it will score. Set up the scaling and the plan encoding correctly."),
  course: COURSES("Predict which learners will finish the course", "Hi, our mentors can only call a few learners each week. Using last term's learners, build a model that predicts who will complete the course, and give me its call for each learner in the new batch."),
  leak: LENDER("Fix: the default model is perfect on history and poor on new loans", "Hi, an intern's default model scored almost perfectly on past loans but did badly on new applications. The code is below. Find out why, and give me predictions I can trust for the new loans."),
  threshold: LENDER("What does the fraud model catch at our cut-off?", "Hello, the fraud model gives each case a score and we flag anything at 0.5 or more. Before the review I need to know how many flags are right, how much fraud we miss, and how busy the team would be at a lower cut-off."),
  cost: LENDER("Pick the cut-off that costs us least", "Hi, a missed default costs us far more than an unnecessary check, but finance keeps arguing about the cut-off. Use the costs below to find the cheapest threshold, and tell me whether a score of 0.8 really means an 80% chance."),
  overfit: COURSES("Which tree depth should we ship?", "Hello, the team trained the same model at twelve depths. The deepest one looks best on the training data and they want to ship it. Tell me which depth to ship and how much the deep tree is over-fitting."),
};

export const DATA_SCIENCE_ML_TEMPLATES: MlTemplate[] = [
  { id: "ds-ab-significance", title: T.ab.title, areas: ["experiment-design"], difficulty: "easy", minLevel: "fresher", build: persist((rng) => abSignificance(rng, T.ab)) },
  { id: "ds-sample-size", title: T.power.title, areas: ["experiment-design"], difficulty: "medium", minLevel: "fresher", build: persist((rng) => sampleSize(rng, T.power)) },
  { id: "ds-simpsons-paradox", title: T.simpson.title, areas: ["experiment-design"], difficulty: "medium", minLevel: "fresher", build: persist((rng) => simpsons(rng, T.simpson)) },
  { id: "ds-multiple-comparisons", title: T.many.title, areas: ["experiment-design"], difficulty: "medium", minLevel: "junior", build: persist((rng) => multipleComparisons(rng, T.many)) },
  { id: "ds-encode-transform", title: T.encode.title, areas: ["feature-engineering"], difficulty: "easy", minLevel: "fresher", build: persist((rng) => encodeAndTransform(rng, T.encode)) },
  { id: "ds-train-only-scaling", title: T.scaling.title, areas: ["feature-engineering"], difficulty: "medium", minLevel: "fresher", build: persist((rng) => trainOnlyScaling(rng, T.scaling)) },
  { id: "ds-course-completion", title: T.course.title, areas: ["model-building"], difficulty: "easy", minLevel: "fresher", build: persist((rng) => buildPredict(COURSE_SPEC, rng, "easy", T.course)) },
  { id: "ds-default-leakage", title: T.leak.title, areas: ["model-building"], difficulty: "medium", minLevel: "junior", build: persist((rng) => buildPredict(DEFAULT_SPEC, rng, "medium", T.leak, { leak: true })) },
  { id: "ds-threshold-metrics", title: T.threshold.title, areas: ["model-evaluation"], difficulty: "easy", minLevel: "fresher", build: persist((rng) => thresholdMetrics(rng, T.threshold)) },
  { id: "ds-overfit-gap", title: T.overfit.title, areas: ["model-evaluation"], difficulty: "easy", minLevel: "fresher", build: persist((rng) => overfitGap(rng, T.overfit)) },
  { id: "ds-cost-calibration", title: T.cost.title, areas: ["model-evaluation"], difficulty: "medium", minLevel: "junior", build: persist((rng) => costAndCalibration(rng, T.cost)) },
];
