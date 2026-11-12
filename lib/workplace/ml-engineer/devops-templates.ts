import type { DevopsTemplate } from "../devops/tickets";
import { make } from "../application-developer/devops-templates";

/**
 * AI/ML Engineer config tickets for the shared config workstation: the files around a model that goes to production (serving image, training
 * workflow, Kubernetes deployment). The server checks the text against rules; nothing is built, trained or deployed.
 */
const ML_LEAD = { name: "Kavya Iyer", title: "ML Platform Lead" };
const SRE = { name: "Karthik Menon", title: "Site Reliability Lead" };

const CI = ".github/workflows/train.yml";
const K8S = "model-serving.yaml";

export const ML_ENGINEER_DEVOPS_TEMPLATES: DevopsTemplate[] = [
  {
    id: "mle-serving-dockerfile", areas: ["mlops-config"], difficulty: "easy", minLevel: "fresher",
    draft: make("Package the churn model so it can be served safely", ML_LEAD,
      "Hi, the churn model runs in a notebook and now has to be served. This Dockerfile was copied from a tutorial: it follows a moving Python tag, installs from whatever is in the folder, runs as root and starts a development server. Please make it fit for production.",
      "Edit the Dockerfile to meet the requirements below.",
      ["Docker", "Model serving", "MLOps"],
      [{ name: "Dockerfile", language: "dockerfile", content: "FROM python:latest\nWORKDIR /app\nCOPY . .\nRUN pip install flask scikit-learn pandas\nEXPOSE 8000\nCMD [\"python\", \"app.py\"]\n" }],
      [
        { kind: "docker", label: "The base image is pinned to a Python version (not latest)", file: "Dockerfile", instr: "FROM", op: "first_matches", value: "^python:3\\.\\d+" },
        { kind: "docker", label: "Dependencies come from requirements.txt, which is copied on its own first", file: "Dockerfile", instr: "COPY", op: "first_matches", value: "^requirements\\.txt\\s" },
        { kind: "docker", label: "pip does not keep its download cache in the image (--no-cache-dir)", file: "Dockerfile", instr: "RUN", op: "matches", value: "pip install.*--no-cache-dir.*-r requirements\\.txt" },
        { kind: "docker", label: "The model file is copied in explicitly (COPY model.joblib)", file: "Dockerfile", instr: "COPY", op: "matches", value: "model\\.joblib" },
        { kind: "docker", label: "The container runs as a non-root user (USER)", file: "Dockerfile", instr: "USER", op: "last_matches", value: "^(?!root$)\\S+" },
        { kind: "docker", label: "The model is served with gunicorn, not the development server", file: "Dockerfile", instr: "CMD", op: "last_matches", value: "gunicorn" },
        { kind: "docker", label: "Port 8000 is still exposed", file: "Dockerfile", instr: "EXPOSE", op: "matches", value: "^8000$" },
      ]),
    solution: [{ name: "Dockerfile", content: "FROM python:3.12-slim\nWORKDIR /app\nCOPY requirements.txt .\nRUN pip install --no-cache-dir -r requirements.txt\nCOPY model.joblib app.py ./\nRUN useradd --create-home appuser\nUSER appuser\nEXPOSE 8000\nCMD [\"gunicorn\", \"-b\", \"0.0.0.0:8000\", \"app:app\"]\n" }],
  },
  {
    id: "mle-training-workflow", areas: ["mlops-config"], difficulty: "medium", minLevel: "fresher",
    draft: make("Retrain on a schedule, but never ship a model that got worse", ML_LEAD,
      "Hello, retraining is done by hand when someone remembers. Please make a workflow that retrains every Monday morning and can also be started by hand, runs the tests first, keeps the trained model file as an artifact, and only publishes it when the run is on the main branch.",
      `Edit ${CI} to meet the requirements below.`,
      ["GitHub Actions", "Retraining", "Model registry"],
      [{ name: CI, language: "yaml", content: "name: train\non:\n  push:\njobs:\n  train:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - run: pip install -r requirements.txt\n      - run: python train.py\n  publish:\n    runs-on: ubuntu-latest\n    steps:\n      - run: python publish.py\n" }],
      [
        { kind: "yaml", label: "The workflow runs on a schedule (cron)", file: CI, path: "on.schedule[*].cron", op: "matches", value: "^\\S+ \\S+ \\S+ \\S+ 1$" },
        { kind: "yaml", label: "The workflow can also be started by hand (workflow_dispatch)", file: CI, path: "on.workflow_dispatch", op: "exists" },
        { kind: "yaml", label: "The train job runs the tests before training (a pytest step)", file: CI, path: "jobs.train.steps[*].run", op: "contains", value: "pytest" },
        { kind: "yaml", label: "The trained model is uploaded with actions/upload-artifact", file: CI, path: "jobs.train.steps[*].uses", op: "contains", value: "actions/upload-artifact" },
        { kind: "yaml", label: "The publish job waits for the train job (needs: train)", file: CI, path: "jobs.publish.needs", op: "contains", value: "train" },
        { kind: "yaml", label: "The publish job runs only on the main branch (if: github.ref == 'refs/heads/main')", file: CI, path: "jobs.publish.if", op: "contains", value: "refs/heads/main" },
        { kind: "yaml", label: "The publish job has a time limit (timeout-minutes)", file: CI, path: "jobs.publish.timeout-minutes", op: "exists" },
      ]),
    solution: [{ name: CI, content: "name: train\non:\n  schedule:\n    - cron: \"0 3 * * 1\"\n  workflow_dispatch:\njobs:\n  train:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - run: pip install -r requirements.txt\n      - run: pytest\n      - run: python train.py\n      - uses: actions/upload-artifact@v4\n        with:\n          name: model\n          path: model.joblib\n  publish:\n    needs: train\n    if: github.ref == 'refs/heads/main'\n    runs-on: ubuntu-latest\n    timeout-minutes: 15\n    steps:\n      - run: python publish.py\n" }],
  },
  {
    id: "mle-serving-deployment", areas: ["mlops-config"], difficulty: "medium", minLevel: "fresher",
    draft: make("Deploy the model server so a bad rollout cannot take it down", SRE,
      "Hi, the model server's manifest has a single replica, a moving image tag and nothing that tells Kubernetes when it is ready, so each rollout drops requests while the model loads. Please fix it, and record which model version is being served so we can tell what is live.",
      `Edit ${K8S} to meet the requirements below.`,
      ["Kubernetes", "Model serving", "Probes"],
      [{ name: K8S, language: "yaml", content: "apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: churn-model\nspec:\n  replicas: 1\n  selector:\n    matchLabels:\n      app: churn-model\n  template:\n    metadata:\n      labels:\n        app: churn-model\n    spec:\n      containers:\n        - name: server\n          image: kaarya/churn-model:latest\n          ports:\n            - containerPort: 8000\n" }],
      [
        { kind: "yaml", label: "There are at least 2 replicas", file: K8S, path: "spec.replicas", op: "matches", value: "^([2-9]|\\d\\d+)$" },
        { kind: "yaml", label: "The image uses a version tag, not latest", file: K8S, path: "spec.template.spec.containers[*].image", op: "matches", value: ":v?\\d" },
        { kind: "yaml", label: "A readiness probe checks an HTTP path, so traffic waits for the model to load", file: K8S, path: "spec.template.spec.containers[*].readinessProbe.httpGet.path", op: "exists" },
        { kind: "yaml", label: "A memory limit is set", file: K8S, path: "spec.template.spec.containers[*].resources.limits.memory", op: "exists" },
        { kind: "yaml", label: "The pods carry a model-version label", file: K8S, path: "spec.template.metadata.labels.model-version", op: "exists" },
        { kind: "yaml", label: "A rollout never removes a pod before its replacement is ready (maxUnavailable: 0)", file: K8S, path: "spec.strategy.rollingUpdate.maxUnavailable", op: "equals", value: 0 },
        { kind: "yaml", label: "The container still listens on port 8000", file: K8S, path: "spec.template.spec.containers[*].ports[*].containerPort", op: "equals", value: 8000 },
      ]),
    solution: [{ name: K8S, content: "apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: churn-model\nspec:\n  replicas: 2\n  strategy:\n    rollingUpdate:\n      maxUnavailable: 0\n      maxSurge: 1\n  selector:\n    matchLabels:\n      app: churn-model\n  template:\n    metadata:\n      labels:\n        app: churn-model\n        model-version: \"2026-06-01\"\n    spec:\n      containers:\n        - name: server\n          image: kaarya/churn-model:1.3.0\n          ports:\n            - containerPort: 8000\n          resources:\n            limits:\n              memory: 1Gi\n          readinessProbe:\n            httpGet:\n              path: /ready\n              port: 8000\n" }],
  },
];
