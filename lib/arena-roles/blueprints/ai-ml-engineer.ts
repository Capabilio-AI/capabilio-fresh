import type { RoleBlueprint } from "../blueprint";

/**
 * IT-07 AI/ML Engineer. Mirrors supabase/migrations/108_ai_ml_role.sql (live) and 135_ai_ml_engineer_areas.sql (NOT applied yet). Every area is served by
 * ml_workspace: a Python notebook (Pyodide) in the student's browser. The server never runs their code. It grades either predictions for hidden test
 * rows against labels it never sent ("client-run"), or numbers it computed itself from the generated data ("computed-key").
 */
export const AI_ML_ENGINEER: RoleBlueprint = {
  roleId: "IT-07",
  domainRoleKey: "ai-ml-engineer",
  name: "AI/ML Engineer",
  competencies: [
    { id: "ml.data_prep", label: "Preparing data for modelling (duplicates, missing values, consistent categories)" },
    { id: "ml.training", label: "Training a classical model that beats a baseline on unseen rows" },
    { id: "ml.evaluation", label: "Choosing and computing the right metric (precision, recall, F1, imbalance)" },
    { id: "ml.leakage", label: "Finding and removing data leakage" },
    { id: "ml.fundamentals", label: "The maths under training (gradient step, softmax, standardisation)" },
    { id: "ml.serving", label: "Serving basics: input contracts, latency and size budgets, version promotion" },
    { id: "ml.error_analysis", label: "Error analysis: slice metrics and finding failing segments" },
    { id: "ml.hygiene", label: "Training hygiene: overfitting, class imbalance, train/test separation" },
  ],
  unassessed: [
    { id: "ml.deep_learning", label: "Deep learning and GPU training (no torch, no GPU in the browser notebook)" },
    { id: "ml.feature_engineering", label: "Open-ended feature engineering (not offered as its own area yet)" },
    { id: "ml.live_serving", label: "Running a real model server, containers or cloud endpoints" },
    { id: "ml.monitoring", label: "Production monitoring and drift response over time" },
    { id: "ml.reproducibility", label: "Experiment tracking and reproducibility (no tracker yet)" },
  ],
  areas: [
    { areaKey: "data-preparation", toolType: "ml_workspace", generationVersion: "ml.gen.v1", gradingVersion: "ml.grade.v1", executionMode: "computed-key", status: "enabled", competencies: ["ml.data_prep"] },
    { areaKey: "model-training", toolType: "ml_workspace", generationVersion: "ml.gen.v1", gradingVersion: "ml.grade.v1", executionMode: "client-run", status: "enabled", competencies: ["ml.training", "ml.evaluation"] },
    { areaKey: "evaluation", toolType: "ml_workspace", generationVersion: "ml.gen.v1", gradingVersion: "ml.grade.v1", executionMode: "computed-key", status: "enabled", competencies: ["ml.evaluation"] },
    { areaKey: "pipeline-debugging", toolType: "ml_workspace", generationVersion: "ml.gen.v1", gradingVersion: "ml.grade.v1", executionMode: "client-run", status: "enabled", competencies: ["ml.leakage", "ml.training"] },
    { areaKey: "ml-fundamentals", toolType: "ml_workspace", generationVersion: "ml.gen.v1", gradingVersion: "ml.grade.v1", executionMode: "computed-key", status: "enabled", competencies: ["ml.fundamentals"] },
    { areaKey: "model-deployment", toolType: "ml_workspace", generationVersion: "ml.gen.v1", gradingVersion: "ml.grade.v1", executionMode: "computed-key", status: "enabled", competencies: ["ml.serving"] },
    { areaKey: "error-analysis", toolType: "ml_workspace", generationVersion: "ml.gen.v1", gradingVersion: "ml.grade.v1", executionMode: "computed-key", status: "enabled", competencies: ["ml.error_analysis", "ml.evaluation"] },
    { areaKey: "training-hygiene", toolType: "ml_workspace", generationVersion: "ml.gen.v1", gradingVersion: "ml.grade.v1", executionMode: "computed-key", status: "enabled", competencies: ["ml.hygiene", "ml.leakage"] },
  ],
  limitations: [
    "Student code runs only in their own browser (Pyodide). The server grades the predictions or numbers they submit, never the code itself.",
    "Prediction tickets report a pass/near/far band, never the exact score, so hidden labels cannot be recovered by trial and error.",
    "Model deployment is assessed through decisions on supplied data (contract checks, budget choice, shadow comparison), not by deploying a model.",
    "Only classical scikit-learn models on tabular data are in scope; deep learning is not assessed.",
    "model-deployment, error-analysis and training-hygiene are served from fixed templates only; AI-written scenarios cover the five original areas.",
  ],
};
