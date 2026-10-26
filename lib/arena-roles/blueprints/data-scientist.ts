import type { RoleBlueprint } from "../blueprint";

/**
 * IT-08 Data Scientist. Mirrors supabase/migrations/130_data_scientist_role.sql, which is NOT yet applied to production (2026-10-26).
 *
 * Distinct from the AI/ML Engineer (pipelines, debugging, deployment): this role is inference, experimentation and communicating results.
 * Execution modes as they really are:
 * - exploratory-analysis (statistics_workspace): the server computes the statistics from the dataset and checks the answers ("computed-key").
 * - experiment-design, feature-engineering, model-evaluation (ml_workspace, numbers tickets): the learner works in a browser notebook; the server
 *   computes every expected number from the generated data and checks within a tolerance ("computed-key").
 * - model-building (ml_workspace, prediction tickets): the learner's model runs in THEIR browser and only its predictions are sent; the server
 *   scores them on hidden labels it never ships and returns a band, never the exact score ("client-run").
 * - data-storytelling (investigation_workspace): the learner's queries run on the company data; findings are checked against answers derived from
 *   the same data ("executed", as for the Data Analyst's investigations).
 */
export const DATA_SCIENTIST: RoleBlueprint = {
  roleId: "IT-08",
  domainRoleKey: "data-scientist",
  name: "Data Scientist",
  competencies: [
    { id: "ds.eda", label: "Exploratory data analysis and summary statistics" },
    { id: "ds.inference", label: "Statistical inference and uncertainty" },
    { id: "ds.experiments", label: "Experiment design and A/B test analysis" },
    { id: "ds.features", label: "Feature engineering without leakage" },
    { id: "ds.modelling", label: "Predictive modelling (binary classification)" },
    { id: "ds.evaluation", label: "Model evaluation, thresholds and calibration" },
    { id: "ds.storytelling", label: "Evidence-based findings for stakeholders" },
  ],
  unassessed: [
    { id: "ds.regression_models", label: "Regression models with continuous targets (the prediction grader scores 0/1 predictions only)" },
    { id: "ds.visualisation", label: "Chart and visual design" },
    { id: "ds.written_communication", label: "Quality of written reports and presentations" },
    { id: "ds.causal", label: "Causal inference beyond randomised experiments" },
  ],
  areas: [
    { areaKey: "exploratory-analysis", toolType: "statistics_workspace", generationVersion: "statistics.gen.v1", gradingVersion: "statistics.grade.v1", executionMode: "computed-key", status: "enabled", competencies: ["ds.eda", "ds.inference"] },
    { areaKey: "experiment-design", toolType: "ml_workspace", generationVersion: "ml.gen.v1", gradingVersion: "ml.grade.v1", executionMode: "computed-key", status: "enabled", competencies: ["ds.experiments", "ds.inference"] },
    { areaKey: "feature-engineering", toolType: "ml_workspace", generationVersion: "ml.gen.v1", gradingVersion: "ml.grade.v1", executionMode: "computed-key", status: "enabled", competencies: ["ds.features"] },
    { areaKey: "model-building", toolType: "ml_workspace", generationVersion: "ml.gen.v1", gradingVersion: "ml.grade.v1", executionMode: "client-run", status: "enabled", competencies: ["ds.modelling", "ds.features"] },
    { areaKey: "model-evaluation", toolType: "ml_workspace", generationVersion: "ml.gen.v1", gradingVersion: "ml.grade.v1", executionMode: "computed-key", status: "enabled", competencies: ["ds.evaluation"] },
    { areaKey: "data-storytelling", toolType: "investigation_workspace", generationVersion: "investigation.gen.v1", gradingVersion: "investigation.grade.v1", executionMode: "executed", status: "enabled", competencies: ["ds.storytelling", "ds.eda"] },
  ],
  limitations: [
    "Notebook code runs only in the learner's browser; the server checks the numbers or predictions submitted, not the code. The explain-your-work interview is the only check of understanding.",
    "Prediction tickets are binary classification scored on accuracy or F1; regression is not assessed.",
    "Storytelling is checked through the correctness of the reported findings, not the quality of a written narrative or chart.",
    "Notebook tickets are fixed templates on fresh random data per user; the scenarios repeat across users, the numbers do not.",
  ],
};
