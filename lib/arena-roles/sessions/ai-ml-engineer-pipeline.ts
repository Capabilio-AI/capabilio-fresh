import type { ProofSessionSpec, SessionStage } from "./data-analyst-story";

// Each stage is one of the AI/ML Engineer's own skill areas, served by the shared ML notebook: the student writes Python in their browser and submits the
// predictions or numbers it produced; the server checks them against its own. See blueprints/ai-ml-engineer.ts for what that does and does not prove.
const STAGES: SessionStage[] = [
  { key: "prepare", areaKey: "data-preparation", title: "Prepare the data", goal: "Clean the customer export the standard way and check the numbers off the clean table." },
  { key: "features", areaKey: "ml-feature-engineering", title: "Build the features", goal: "Turn the raw columns into features a model can learn from, without leaking the label." },
  { key: "train", areaKey: "model-training", title: "Train the model", goal: "Train a model that beats the baseline on customers it has never seen." },
  { key: "evaluate", areaKey: "evaluation", title: "Judge it honestly", goal: "Count what the model really gets right with the metric that fits the problem." },
  { key: "ship", areaKey: "model-deployment", title: "Decide what ships", goal: "Make the serving decision: contract checks, the budget, or whether the new version replaces the live one." },
  { key: "monitor", areaKey: "drift-monitoring", title: "Watch it in production", goal: "Find which inputs have drifted and when the quality alert should have fired." },
];

export const AI_ML_PIPELINE: ProofSessionSpec = {
  key: "aiml-model-lifecycle",
  version: 1,
  roleId: "IT-07",
  domainRoleKey: "ai-ml-engineer",
  title: "Prepare, build, judge, ship and monitor a churn model",
  worldKey: "none",
  claimSubject: "a simulated machine-learning work session",
  intro: "One connected piece of ML work in six stages: prepare the data, build features, train a model, judge it, decide what ships, and watch it in production. Each stage is a notebook you run in your browser, on fictional customer data. About an hour or two. You explain your work at the end.",
  stagesFor: () => STAGES,
  limitations: [
    "Your Python runs in your own browser; the server checks the predictions or numbers it produced, not the code. Each stage is a separate exercise on its own data, not one growing pipeline.",
    "Only classical models on tabular data are used. There is no GPU, no deep-learning framework, no real model server, experiment tracker or monitoring dashboard, so those skills are not assessed.",
    "Activity signals such as reading the brief or writing a plan are reported by the browser and can be faked; they are marked lower-confidence.",
    "Dimension levels describe what the session log shows. They never decide pass or fail.",
  ],
};
