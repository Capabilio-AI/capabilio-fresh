import type { DevopsTemplate } from "../devops/tickets";
import { make } from "../application-developer/devops-templates";

/**
 * Cloud and Platform Support Engineer tickets for the shared config workstation: the fixes a support engineer makes to a customer's container image,
 * Kubernetes manifests, IAM policy and Compose file. The server checks the file text against rules; nothing is built, applied or deployed.
 */
const ONCALL = { name: "Karthik Menon", title: "Site Reliability Lead" };
const SECURITY = { name: "Meera Pillai", title: "Cloud Security Lead" };
const SUPPORT = { name: "Farah Sheikh", title: "Customer Support Lead" };

const DEPLOYMENT = "deployment.yaml";
const SERVICE = "k8s.yaml";
const POLICY = "policy.json";
const COMPOSE = "docker-compose.yml";

export const CLOUD_SUPPORT_DEVOPS_TEMPLATES: DevopsTemplate[] = [
  {
    id: "cps-harden-node-image", areas: ["cps-container-fixes"], difficulty: "easy", minLevel: "fresher",
    draft: make("Customer's Node image runs as root and is never marked unhealthy", SECURITY,
      "Hi, a customer's security scan flagged their Node.js image: it runs as root, uses a moving 'latest' tag, installs development packages and has no health check, so the platform keeps routing traffic to a crashed container. Please fix the Dockerfile.",
      "Edit the Dockerfile to meet the requirements below.",
      ["Docker", "Container security", "Health checks"],
      [{ name: "Dockerfile", language: "dockerfile", content: "FROM node:latest\nWORKDIR /app\nCOPY . .\nRUN npm install\nEXPOSE 3000\nCMD [\"node\", \"server.js\"]\n" }],
      [
        { kind: "docker", label: "The base image is pinned to a Node version (not latest)", file: "Dockerfile", instr: "FROM", op: "first_matches", value: "^node:\\d+" },
        { kind: "docker", label: "Only production packages are installed (npm ci --omit=dev)", file: "Dockerfile", instr: "RUN", op: "matches", value: "npm ci.*--omit=dev" },
        { kind: "docker", label: "NODE_ENV is set to production", file: "Dockerfile", instr: "ENV", op: "matches", value: "^NODE_ENV[= ]production$" },
        { kind: "docker", label: "The container runs as the unprivileged node user (USER node)", file: "Dockerfile", instr: "USER", op: "last_matches", value: "^node$" },
        { kind: "docker", label: "A HEALTHCHECK is defined", file: "Dockerfile", instr: "HEALTHCHECK", op: "exists" },
        { kind: "docker", label: "Port 3000 is still exposed", file: "Dockerfile", instr: "EXPOSE", op: "matches", value: "^3000$" },
      ]),
    solution: [{ name: "Dockerfile", content: "FROM node:20-alpine\nENV NODE_ENV=production\nWORKDIR /app\nCOPY package*.json ./\nRUN npm ci --omit=dev\nCOPY . .\nUSER node\nEXPOSE 3000\nHEALTHCHECK CMD wget -qO- http://localhost:3000/health || exit 1\nCMD [\"node\", \"server.js\"]\n" }],
  },
  {
    id: "cps-slim-the-frontend-image", areas: ["cps-container-fixes"], difficulty: "medium", minLevel: "fresher",
    draft: make("Customer's frontend image is over a gigabyte and slow to roll out", ONCALL,
      "Hi, a customer's static website image carries Node.js, all the source code and every build tool into production, so each rollout pulls over a gigabyte and takes minutes. Please change it to a multi-stage build: build the site in one stage and ship only the built files from a small web server image.",
      "Edit the Dockerfile to meet the requirements below.",
      ["Docker", "Multi-stage builds", "Image size"],
      [{ name: "Dockerfile", language: "dockerfile", content: "FROM node:20\nWORKDIR /app\nCOPY . .\nRUN npm ci\nRUN npm run build\nEXPOSE 80\nCMD [\"npx\", \"serve\", \"-s\", \"dist\", \"-l\", \"80\"]\n" }],
      [
        { kind: "docker", label: "The first stage is named build (FROM ... AS build)", file: "Dockerfile", instr: "FROM", op: "first_matches", value: "\\sAS\\s+build$" },
        { kind: "docker", label: "The stage that ships is a small nginx image with a version tag", file: "Dockerfile", instr: "FROM", op: "last_matches", value: "^nginx:\\d" },
        { kind: "docker", label: "Only the built files are copied from the build stage into nginx (COPY --from=build /app/dist /usr/share/nginx/html)", file: "Dockerfile", instr: "COPY", op: "matches", value: "--from=build\\s+/app/dist\\s+/usr/share/nginx/html" },
        { kind: "docker", label: "The build stage still installs packages with npm ci", file: "Dockerfile", instr: "RUN", op: "matches", value: "^npm ci" },
        { kind: "docker", label: "The build stage still runs npm run build", file: "Dockerfile", instr: "RUN", op: "matches", value: "npm run build" },
        { kind: "docker", label: "Port 80 is still exposed", file: "Dockerfile", instr: "EXPOSE", op: "matches", value: "^80$" },
      ]),
    solution: [{ name: "Dockerfile", content: "FROM node:20 AS build\nWORKDIR /app\nCOPY package*.json ./\nRUN npm ci\nCOPY . .\nRUN npm run build\n\nFROM nginx:1.27-alpine\nCOPY --from=build /app/dist /usr/share/nginx/html\nEXPOSE 80\n" }],
  },
  {
    id: "cps-deployment-keeps-restarting", areas: ["cps-kubernetes-manifests"], difficulty: "easy", minLevel: "fresher",
    draft: make("Customer's pods are killed and traffic reaches pods that are not ready", ONCALL,
      "Hello, the billing API on a customer's cluster restarts every few hours with out-of-memory kills, and during each rollout users see errors because traffic reaches pods that are still starting. The manifest has one replica, an image tag that can change under us, and no limits or readiness probe. Please fix it.",
      `Edit ${DEPLOYMENT} to meet the requirements below.`,
      ["Kubernetes", "Resource limits", "Probes"],
      [{ name: DEPLOYMENT, language: "yaml", content: "apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: billing-api\nspec:\n  replicas: 1\n  selector:\n    matchLabels:\n      app: billing-api\n  template:\n    metadata:\n      labels:\n        app: billing-api\n    spec:\n      containers:\n        - name: api\n          image: kaarya/billing-api:latest\n          ports:\n            - containerPort: 8080\n" }],
      [
        { kind: "yaml", label: "There are at least 2 replicas", file: DEPLOYMENT, path: "spec.replicas", op: "matches", value: "^([2-9]|\\d\\d+)$" },
        { kind: "yaml", label: "The image uses a version tag, not latest", file: DEPLOYMENT, path: "spec.template.spec.containers[*].image", op: "matches", value: ":v?\\d" },
        { kind: "yaml", label: "A memory limit is set", file: DEPLOYMENT, path: "spec.template.spec.containers[*].resources.limits.memory", op: "exists" },
        { kind: "yaml", label: "A memory request is set", file: DEPLOYMENT, path: "spec.template.spec.containers[*].resources.requests.memory", op: "exists" },
        { kind: "yaml", label: "A readiness probe checks an HTTP path", file: DEPLOYMENT, path: "spec.template.spec.containers[*].readinessProbe.httpGet.path", op: "exists" },
        { kind: "yaml", label: "The container still listens on port 8080", file: DEPLOYMENT, path: "spec.template.spec.containers[*].ports[*].containerPort", op: "equals", value: 8080 },
      ]),
    solution: [{ name: DEPLOYMENT, content: "apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: billing-api\nspec:\n  replicas: 2\n  selector:\n    matchLabels:\n      app: billing-api\n  template:\n    metadata:\n      labels:\n        app: billing-api\n    spec:\n      containers:\n        - name: api\n          image: kaarya/billing-api:1.4.2\n          ports:\n            - containerPort: 8080\n          resources:\n            requests:\n              memory: 256Mi\n            limits:\n              memory: 512Mi\n          readinessProbe:\n            httpGet:\n              path: /health\n              port: 8080\n" }],
  },
  {
    id: "cps-service-has-no-endpoints", areas: ["cps-kubernetes-manifests"], difficulty: "medium", minLevel: "fresher",
    draft: make("Customer's service answers 'connection refused' although the pods are running", SUPPORT,
      "Hi, a customer's pods are all healthy, yet calls to the billing service fail with 'connection refused'. They deployed the Deployment and Service together and cannot see what is wrong. Please find the mismatch in the file and fix it without changing the Deployment.",
      `Edit the Service in ${SERVICE} to meet the requirements below. The Deployment is correct.`,
      ["Kubernetes", "Services", "Selectors", "Troubleshooting"],
      [{ name: SERVICE, language: "yaml", content: "apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: billing-api\nspec:\n  replicas: 2\n  selector:\n    matchLabels:\n      app: billing-api\n  template:\n    metadata:\n      labels:\n        app: billing-api\n    spec:\n      containers:\n        - name: api\n          image: kaarya/billing-api:1.4.2\n          ports:\n            - containerPort: 8080\n---\napiVersion: v1\nkind: Service\nmetadata:\n  name: billing\nspec:\n  selector:\n    app: billing\n  ports:\n    - port: 80\n      targetPort: 80\n" }],
      [
        { kind: "yaml", label: "The Service selector matches the pod label app: billing-api", file: SERVICE, path: "spec.selector.app", op: "equals", value: "billing-api" },
        { kind: "yaml", label: "The Service sends traffic to the container port 8080 (targetPort)", file: SERVICE, path: "spec.ports[*].targetPort", op: "equals", value: 8080 },
        { kind: "yaml", label: "The Service still listens on port 80", file: SERVICE, path: "spec.ports[*].port", op: "equals", value: 80 },
        { kind: "yaml", label: "The Deployment is unchanged: pods are still labelled app: billing-api", file: SERVICE, path: "spec.template.metadata.labels.app", op: "equals", value: "billing-api" },
        { kind: "yaml", label: "The Deployment is unchanged: the container still listens on 8080", file: SERVICE, path: "spec.template.spec.containers[*].ports[*].containerPort", op: "equals", value: 8080 },
      ]),
    solution: [{ name: SERVICE, content: "apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: billing-api\nspec:\n  replicas: 2\n  selector:\n    matchLabels:\n      app: billing-api\n  template:\n    metadata:\n      labels:\n        app: billing-api\n    spec:\n      containers:\n        - name: api\n          image: kaarya/billing-api:1.4.2\n          ports:\n            - containerPort: 8080\n---\napiVersion: v1\nkind: Service\nmetadata:\n  name: billing\nspec:\n  selector:\n    app: billing-api\n  ports:\n    - port: 80\n      targetPort: 8080\n" }],
  },
  {
    id: "cps-least-privilege-report-reader", areas: ["cps-access-and-secrets"], difficulty: "easy", minLevel: "fresher",
    draft: make("Reporting tool has full access to every storage bucket", SECURITY,
      "Hello, the reporting tool only has to read the monthly PDFs from one bucket, but its IAM policy allows every S3 action on every bucket, so a leaked key could delete all our customers' data. Please reduce it to what the tool really needs.",
      `Edit ${POLICY} to meet the requirements below.`,
      ["IAM", "Least privilege", "S3"],
      [{ name: POLICY, language: "json", content: "{\n  \"Version\": \"2012-10-17\",\n  \"Statement\": [\n    {\n      \"Effect\": \"Allow\",\n      \"Action\": \"s3:*\",\n      \"Resource\": \"*\"\n    }\n  ]\n}\n" }],
      [
        { kind: "regex", label: "The policy no longer allows every S3 action (s3:*)", file: POLICY, pattern: "s3:\\*", op: "not_matches" },
        { kind: "regex", label: "The policy allows s3:GetObject", file: POLICY, pattern: "s3:GetObject", op: "matches" },
        { kind: "regex", label: "The policy does not allow writes or deletes (s3:Put, s3:Delete)", file: POLICY, pattern: "s3:(Put|Delete)", op: "not_matches" },
        { kind: "regex", label: "The resource is no longer '*'", file: POLICY, pattern: "\"Resource\":\\s*\"\\*\"", op: "not_matches" },
        { kind: "regex", label: "The resource is the objects of the kaarya-reports bucket", file: POLICY, pattern: "arn:aws:s3:::kaarya-reports/\\*", op: "matches" },
        { kind: "regex", label: "The statement still has \"Effect\": \"Allow\"", file: POLICY, pattern: "\"Effect\":\\s*\"Allow\"", op: "matches" },
      ]),
    solution: [{ name: POLICY, content: "{\n  \"Version\": \"2012-10-17\",\n  \"Statement\": [\n    {\n      \"Effect\": \"Allow\",\n      \"Action\": \"s3:GetObject\",\n      \"Resource\": \"arn:aws:s3:::kaarya-reports/*\"\n    }\n  ]\n}\n" }],
  },
  {
    id: "cps-compose-secrets-and-exposure", areas: ["cps-access-and-secrets"], difficulty: "medium", minLevel: "fresher",
    draft: make("Customer's database password is in the Compose file and the port is open to the world", SECURITY,
      "Hi, a customer committed their docker-compose.yml with the Postgres password in it, and the database port is published on every network interface of the server. Please keep the password out of the file, publish the port on the local machine only, and make the container restart and report its health.",
      `Edit ${COMPOSE} to meet the requirements below.`,
      ["Docker Compose", "Secrets", "Network exposure"],
      [{ name: COMPOSE, language: "yaml", content: "services:\n  db:\n    image: postgres:16\n    environment:\n      POSTGRES_USER: app\n      POSTGRES_PASSWORD: hunter2\n    ports:\n      - \"5432:5432\"\n" }],
      [
        { kind: "yaml", label: "The password is read from the environment, not written in the file (POSTGRES_PASSWORD: ${POSTGRES_PASSWORD})", file: COMPOSE, path: "services.db.environment.POSTGRES_PASSWORD", op: "matches", value: "^\\$\\{POSTGRES_PASSWORD" },
        { kind: "regex", label: "The old password no longer appears anywhere in the file", file: COMPOSE, pattern: "hunter2", op: "not_matches" },
        { kind: "yaml", label: "The port is published on 127.0.0.1 only", file: COMPOSE, path: "services.db.ports[*]", op: "matches", value: "^127\\.0\\.0\\.1:5432:5432$" },
        { kind: "yaml", label: "The database restarts unless it was stopped on purpose (restart: unless-stopped)", file: COMPOSE, path: "services.db.restart", op: "equals", value: "unless-stopped" },
        { kind: "yaml", label: "A health check runs pg_isready", file: COMPOSE, path: "services.db.healthcheck.test", op: "contains", value: "pg_isready" },
        { kind: "yaml", label: "The image is still postgres:16", file: COMPOSE, path: "services.db.image", op: "equals", value: "postgres:16" },
      ]),
    solution: [{ name: COMPOSE, content: "services:\n  db:\n    image: postgres:16\n    restart: unless-stopped\n    environment:\n      POSTGRES_USER: app\n      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}\n    ports:\n      - \"127.0.0.1:5432:5432\"\n    healthcheck:\n      test: [\"CMD-SHELL\", \"pg_isready -U app\"]\n      interval: 10s\n" }],
  },
];
