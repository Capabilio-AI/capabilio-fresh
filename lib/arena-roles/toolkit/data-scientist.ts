import type { RoleToolkit } from "./types";

/** IT-08 Data Scientist. W07 notebook + W04 Stats Lab + investigation desk (docs/arena-roles/workstation-design.md), mirroring migration 130. */
export const TOOLKIT: RoleToolkit = {
  roleKey: "data-scientist",
  roleId: "IT-08",
  stream: "Data Science",
  headline: "Explore data, design and read experiments, build and evaluate models, and tell stakeholders what the numbers really say.",
  workstations: [
    {
      name: "Data Science Notebook",
      mirrors: ["Jupyter", "Google Colab", "scipy.stats", "scikit-learn"],
      toolType: "ml_workspace",
      tier: "R",
      runsIn: "browser",
      summary: "Write Python against the ticket's CSV files to test experiments, engineer features, build and evaluate models, then submit numbers or predictions.",
    },
    {
      name: "Stats Lab",
      mirrors: ["R", "SPSS", "statsmodels"],
      toolType: "statistics_workspace",
      tier: "S",
      runsIn: "browser",
      summary: "Profile a sample of the company's orders: centre, spread, correlation and confidence intervals.",
    },
    {
      name: "Findings Desk",
      mirrors: ["SQL client", "Metabase", "Jupyter SQL"],
      toolType: "investigation_workspace",
      tier: "R",
      runsIn: "browser",
      summary: "Query the company warehouse and report the three or four facts a stakeholder's story rests on.",
    },
  ],
  environment: [
    { label: "Python in the browser", detail: "Pyodide, started on first run; the first start downloads Python and its libraries, which can take a minute." },
    { label: "Libraries", detail: "numpy, pandas, scipy and scikit-learn are preloaded. There is no pip and no network from the notebook." },
    { label: "Company data", detail: "BrightCart's customers, products, orders and order lines in an in-browser SQLite database, rebuilt the same way for you every time." },
    { label: "Ticket files", detail: "Each notebook ticket's CSVs (A/B test logs, train/test splits, model scores) sit next to the notebook. All companies and people are fictional." },
  ],
  firstWeek: [
    "Profile how long new customers take to place a first order",
    "Read a finished A/B test and decide whether the uplift is real",
    "Size a test before it runs: users per variant and days needed",
    "Prepare features with the scaler learnt from training rows only",
    "Predict which learners will finish a course, scored on rows you never see",
    "Find the cheapest decision threshold for a risk model",
    "Give the board the three numbers behind a spike in returns",
  ],
  portfolioArtifacts: [
    "Graded experiment, feature and evaluation tickets with per-check results",
    "Graded prediction tickets, with the notebook code kept for the explain-your-work interview",
    "Storytelling findings checked against the company data",
  ],
  honestLimits: [
    "Your notebook code runs only in your browser; the server checks what you submit, not how you wrote it.",
    "No plotting library is loaded (no matplotlib); print tables and numbers instead. Charts are not assessed.",
    "Prediction tickets are yes/no classification only; regression models are not assessed.",
    "Storytelling is judged on the correctness of your findings, not on how well a report or slide is written.",
  ],
};
