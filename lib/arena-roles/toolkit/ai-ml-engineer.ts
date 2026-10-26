import type { RoleToolkit } from "./types";

/** IT-07 AI/ML Engineer. One workstation, the ML notebook (W09/W07 in docs/arena-roles/workstation-design.md), serving all eight areas. */
export const TOOLKIT: RoleToolkit = {
  roleKey: "ai-ml-engineer",
  roleId: "IT-07",
  stream: "AI & ML",
  headline: "Prepare data, train and evaluate classical models, and make the calls an ML engineer makes before a model ships.",
  workstations: [
    {
      name: "ML Notebook",
      mirrors: ["Jupyter", "Google Colab", "scikit-learn"],
      toolType: "ml_workspace",
      tier: "R",
      runsIn: "browser",
      summary: "Write Python against the ticket's CSV files, then submit predictions for the hidden test rows or the numbers the ticket asks for.",
    },
  ],
  environment: [
    { label: "Python in the browser", detail: "Pyodide, started on first run. The first start downloads Python and its libraries, which can take a minute." },
    { label: "Libraries", detail: "numpy, pandas and scikit-learn (with scipy, which scikit-learn needs). Nothing else can be installed." },
    { label: "Data", detail: "Each ticket's files (train.csv, test.csv, results logs, request samples) are preloaded next to the notebook. All companies and people are fictional." },
  ],
  firstWeek: [
    "Clean a messy customer export and report numbers off the clean table",
    "Train a model that predicts which customers will leave, scored on rows you never see",
    "Count what a model really gets right: precision, recall and F1 against a lazy baseline",
    "Find the store where an accurate-looking model fails",
    "Check a sample of requests against the serving contract",
    "Read a depth sweep and pick the depth to ship before the tree overfits",
  ],
  portfolioArtifacts: [
    "Graded prediction tickets, with the notebook code kept for the explain-your-work interview",
    "Graded deployment, error-analysis and training-hygiene decisions with per-check results",
  ],
  honestLimits: [
    "Your code runs only in your browser; the server checks what you submit, not how you wrote it.",
    "No GPU, no torch or TensorFlow, and no network from the notebook: deep learning and GPU training are not assessed.",
    "No plotting library is loaded (no matplotlib); print tables and numbers instead.",
    "Deployment is assessed through decisions on supplied data, not by running a real model server or cloud endpoint.",
    "No experiment tracker or drift monitoring yet.",
  ],
};
