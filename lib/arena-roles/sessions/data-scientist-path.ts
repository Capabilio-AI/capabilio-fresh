import type { ProofSessionSpec, SessionStage } from "./data-analyst-story";

/**
 * The Data Scientist path: four Proof Sessions, one per level, opened one after another. Each is a connected piece of the job built from the six areas that already have a
 * workstation and a grader, on the student's own seeded data. Passing a session's stages writes the same evidence an ordinary ticket writes (skill ratings, portfolio, role
 * rating), so nothing downstream changes. Honest limit repeated in every report: each stage is graded on its own data; a later stage is not computed from an earlier answer.
 */

const stage = (key: string, areaKey: string, title: string, goal: string, extra: Partial<SessionStage> = {}): SessionStage => ({ key, areaKey, title, goal, ...extra });

const LIMITS = [
  "Each stage is graded by its own workstation on data generated for you. A later stage is not computed from your earlier answer, so the chain shows the work done, not one end-to-end pipeline.",
  "Notebook code runs in your browser; the server checks the numbers or predictions you submit, not how you wrote them. The explain-your-work interview is the check of understanding.",
  "Written report quality and chart design are not scored; findings are checked for correctness only.",
  "Activity signals such as reading the brief are reported by the browser and can be faked; they are marked lower-trust.",
];

const base = { roleId: "IT-08", domainRoleKey: "data-scientist", version: 1, worldKey: "brightcart", limitations: LIMITS } as const;

export const DS_BEGINNER: ProofSessionSpec = {
  ...base,
  key: "ds-1-read-the-data",
  title: "Level 1: Read the data",
  claimSubject: "a simulated BrightCart data profile and findings brief",
  intro: "Monday, 9:10. The operations lead says something moved in the numbers and needs facts before a 10:00 meeting. Two stages on your own company data: profile the numbers, then find what is behind the movement and report it with evidence. About an hour. You explain your work at the end.",
  stagesFor: () => [
    stage("profile", "exploratory-analysis", "Profile the numbers", "Compute the centre, spread and relationships the ops lead will ask about, from the sample you are given."),
    stage("findings", "data-storytelling", "Report the facts", "Query the company data and report the three or four facts the story rests on.", { explorable: true }),
  ],
};

export const DS_INTERMEDIATE: ProofSessionSpec = {
  ...base,
  key: "ds-2-decide-with-evidence",
  title: "Level 2: Decide with evidence",
  claimSubject: "a simulated BrightCart experiment readout and feature preparation",
  intro: "The product manager wants a ship decision. Three stages: design or read the experiment so the decision is sound, prepare the features without leaking test data, and report what the numbers support. About 90 minutes. You explain your work at the end.",
  stagesFor: () => [
    stage("design", "experiment-design", "Make the experiment sound", "Size the test, or read a finished one, and say whether the uplift is real."),
    stage("features", "feature-engineering", "Prepare the features", "Prepare the inputs with everything learnt from training rows only."),
    stage("findings", "data-storytelling", "Tell the PM what the data supports", "Query the company data and report the facts behind the decision.", { explorable: true }),
  ],
};

export const DS_ADVANCED: ProofSessionSpec = {
  ...base,
  key: "ds-3-build-the-model",
  title: "Level 3: Build the model",
  claimSubject: "a simulated BrightCart modelling task, from features to a decision threshold",
  intro: "Four stages that make one model project: prepare the features, build a model that predicts rows you never see, judge it honestly, and explain it. AI help is allowed and recorded. About two hours. You explain your work at the end.",
  stagesFor: () => [
    stage("features", "feature-engineering", "Prepare the features", "Prepare the inputs without leaking information from outside the training rows."),
    stage("model", "model-building", "Build the model", "Predict the hidden rows. You are scored on labels you never see."),
    stage("evaluate", "model-evaluation", "Judge it honestly", "Choose a threshold, read the overfitting gap and say what the model costs the business."),
    stage("findings", "data-storytelling", "Explain it to the business", "Query the company data and report the facts a stakeholder needs.", { explorable: true }),
  ],
};

export const DS_EXPERT: ProofSessionSpec = {
  ...base,
  key: "ds-4-hold-up-on-the-job",
  title: "Level 4: Hold up on the job",
  claimSubject: "a simulated full data-science workday at BrightCart",
  intro: "A full day compressed: explore the data, make the experiment sound, prepare features, build and judge a model, and report to the board. Six stages, no shortcuts, the stakes of a real workday. Two to three hours. This is the capstone: you explain your work at the end, and it is the evidence a recruiter can read.",
  stagesFor: () => [
    stage("explore", "exploratory-analysis", "Know the data", "Profile the numbers the rest of the day depends on."),
    stage("design", "experiment-design", "Make the experiment sound", "Size or read the test and give a decision you can defend."),
    stage("features", "feature-engineering", "Prepare the features", "Prepare the inputs with nothing leaked from outside the training rows."),
    stage("model", "model-building", "Build the model", "Predict the hidden rows."),
    stage("evaluate", "model-evaluation", "Judge it and set the threshold", "Choose the threshold that fits the cost and say how far to trust the model."),
    stage("findings", "data-storytelling", "Brief the board", "Query the company data and report the facts the board needs.", { explorable: true }),
  ],
};

/** The path in the order it is walked. */
export const DATA_SCIENTIST_PATH: readonly ProofSessionSpec[] = [DS_BEGINNER, DS_INTERMEDIATE, DS_ADVANCED, DS_EXPERT];
