import type { RoleBlueprint } from "../blueprint";

/**
 * IT-07 AI/ML Engineer. Mirrors supabase/migrations/108_ai_ml_role.sql (live), 135_ai_ml_engineer_areas.sql and 191_ai_ml_lifecycle_areas.sql (the last two NOT
 * applied yet). Every area but mlops-config is served by ml_workspace: a Python notebook (Pyodide) in the student's browser; mlops-config uses the shared
 * config workstation (files checked as text). The server never runs their code. It grades either predictions for hidden test
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
    { id: "ml.feature_engineering", label: "Feature engineering: per-unit ratios, rare categories, date features and leak-free target encoding" },
    { id: "ml.reproducibility", label: "Experiment tracking: choosing a run on validation, reproducibility of a run, noise between seeds" },
    { id: "ml.monitoring", label: "Monitoring: input drift (population stability index) and rolling-metric alerts" },
    { id: "ml.nn_basics", label: "Neural-network basics by hand: forward pass, cross-entropy and one backpropagation step" },
    { id: "ml.python", label: "Plain Python under ML code: scaling, metrics, encoding, rolling averages and similarity search without a library" },
    { id: "ml.sql", label: "SQL for ML data: label tables, point-in-time feature tables and window features" },
    { id: "ml.algorithm_selection", label: "Choosing and tuning algorithms: cross-validation comparison, grid search, k-means elbow, ROC-AUC and PCA" },
    { id: "ml.mlops_config", label: "Production files around a model: serving image, retraining workflow and Kubernetes deployment" },
  ],
  unassessed: [
    { id: "ml.deep_learning", label: "Training deep networks with a framework and a GPU (no torch, no GPU in the browser notebook)" },
    { id: "ml.live_serving", label: "Running a real model server, containers or cloud endpoints" },
    { id: "ml.live_monitoring", label: "Live monitoring dashboards and responding to drift over time" },
    { id: "ml.tracker", label: "A real experiment tracker (MLflow, Weights & Biases) and model registry" },
    { id: "ml.genai", label: "LLM and retrieval-augmented (RAG) application work" },
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
    { areaKey: "ml-feature-engineering", toolType: "ml_workspace", generationVersion: "ml.gen.v1", gradingVersion: "ml.grade.v1", executionMode: "computed-key", status: "enabled", competencies: ["ml.feature_engineering", "ml.data_prep"] },
    { areaKey: "experiment-tracking", toolType: "ml_workspace", generationVersion: "ml.gen.v1", gradingVersion: "ml.grade.v1", executionMode: "computed-key", status: "enabled", competencies: ["ml.reproducibility"] },
    { areaKey: "drift-monitoring", toolType: "ml_workspace", generationVersion: "ml.gen.v1", gradingVersion: "ml.grade.v1", executionMode: "computed-key", status: "enabled", competencies: ["ml.monitoring"] },
    { areaKey: "neural-networks", toolType: "ml_workspace", generationVersion: "ml.gen.v1", gradingVersion: "ml.grade.v1", executionMode: "computed-key", status: "enabled", competencies: ["ml.nn_basics", "ml.fundamentals"] },
    { areaKey: "mle-algorithm-selection", toolType: "ml_workspace", generationVersion: "ml.gen.v1", gradingVersion: "ml.grade.v1", executionMode: "computed-key", status: "enabled", competencies: ["ml.algorithm_selection", "ml.evaluation"] },
    { areaKey: "mle-python", toolType: "code_workspace", generationVersion: "code.gen.v1", gradingVersion: "code.grade.v1", executionMode: "client-run", status: "enabled", competencies: ["ml.python"] },
    { areaKey: "mle-data-sql", toolType: "sql_workspace", generationVersion: "sql.gen.v1", gradingVersion: "sql.grade.v1", executionMode: "executed", status: "enabled", competencies: ["ml.sql", "ml.data_prep"] },
    { areaKey: "mlops-config", toolType: "devops_workspace", generationVersion: "devops.gen.v1", gradingVersion: "devops.grade.v1", executionMode: "computed-key", status: "enabled", competencies: ["ml.mlops_config", "ml.serving"] },
  ],
  limitations: [
    "Student code runs only in their own browser (Pyodide). The server grades the predictions or numbers they submit, never the code itself.",
    "Prediction tickets report a pass/near/far band, never the exact score, so hidden labels cannot be recovered by trial and error.",
    "Model deployment is assessed through decisions on supplied data (contract checks, budget choice, shadow comparison), not by deploying a model.",
    "Only classical scikit-learn models on tabular data are in scope. Neural networks are assessed only as hand calculations in NumPy (forward pass, loss, one gradient step); training with a deep-learning framework or a GPU is not.",
    "Every area except the five original ones is served from fixed templates only; AI-written scenarios cover the five original areas.",
    "Experiment tracking and monitoring are decisions and calculations on supplied logs and distributions, not a real tracker, registry or live dashboard.",
    "mle-python tickets run the student's function in their own browser; the server compares the outputs it is sent with its own answers and never runs or reads the code.",
    "mle-data-sql tickets are real SQL run by the server on a fresh SQLite copy of the BrightCart warehouse, not PostgreSQL or a feature store.",
    "mlops-config files (Dockerfile, workflow, Kubernetes YAML) are checked as text; nothing is built, trained or deployed.",
  ],
};
