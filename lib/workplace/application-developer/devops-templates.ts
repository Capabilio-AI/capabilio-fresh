import { MAX_SUBMISSIONS, type FileContent } from "../file-tasks/types";
import type { Check } from "../devops/checks";
import type { DevopsDraft, DevopsTemplate } from "../devops/tickets";

/** Application Developer build-and-config tickets for the shared config workstation: the server checks the file text against rules; nothing is built or run. */
const LEAD = { name: "Aditya Rao", title: "Tech Lead" };
const SECURITY = { name: "Meenakshi Pillai", title: "Security Engineer" };

const make = (title: string, requester: DevopsDraft["requester"], scenario: string, deliverable: string, tags: string[], files: FileContent["files"], checks: Check[]): DevopsDraft => ({
  title, requester, scenario, skillTags: tags,
  content: { files, requirements: checks.map((c) => c.label), deliverable, maxSubmissions: MAX_SUBMISSIONS },
  key: { checks },
});
const CI = ".github/workflows/ci.yml";

export const APP_DEV_DEVOPS_TEMPLATES: DevopsTemplate[] = [
  {
    id: "appdev-python-dockerfile", areas: ["build-and-config"], difficulty: "easy", minLevel: "fresher",
    draft: make("Fix the Dockerfile for the Flask API", LEAD,
      "Hi, the Flask API's image takes ten minutes to build because every code change reinstalls all packages, it pulls whatever 'latest' Python happens to be, and it starts with the development server. Please fix the Dockerfile before we deploy to staging.",
      "Edit the Dockerfile to meet the requirements below.",
      ["Docker", "Dockerfile", "Python"],
      [{ name: "Dockerfile", language: "dockerfile", content: "FROM python:latest\nWORKDIR /app\nCOPY . .\nRUN pip install -r requirements.txt\nEXPOSE 5000\nCMD [\"flask\", \"run\", \"--host=0.0.0.0\"]\n" }],
      [
        { kind: "docker", label: "The base image is pinned to a Python version (not latest)", file: "Dockerfile", instr: "FROM", op: "first_matches", value: "^python:3\\.\\d+" },
        { kind: "docker", label: "requirements.txt is copied on its own before the rest of the code", file: "Dockerfile", instr: "COPY", op: "first_matches", value: "^requirements\\.txt\\s" },
        { kind: "docker", label: "Packages are installed before the application code is copied", file: "Dockerfile", instr: "RUN", op: "before", value: "pip install", other: "COPY \\. \\." },
        { kind: "docker", label: "pip does not keep its download cache in the image (--no-cache-dir)", file: "Dockerfile", instr: "RUN", op: "matches", value: "pip install.*--no-cache-dir" },
        { kind: "docker", label: "The app starts with gunicorn, not the flask development server", file: "Dockerfile", instr: "CMD", op: "last_matches", value: "gunicorn" },
        { kind: "docker", label: "Port 5000 is still exposed", file: "Dockerfile", instr: "EXPOSE", op: "matches", value: "^5000$" },
      ]),
    solution: [{ name: "Dockerfile", content: "FROM python:3.12-slim\nWORKDIR /app\nCOPY requirements.txt .\nRUN pip install --no-cache-dir -r requirements.txt\nCOPY . .\nEXPOSE 5000\nCMD [\"gunicorn\", \"-b\", \"0.0.0.0:5000\", \"app:app\"]\n" }],
  },
  {
    id: "appdev-env-example", areas: ["build-and-config"], difficulty: "easy", minLevel: "fresher",
    draft: make("Stop committing the real .env file", SECURITY,
      "Hello, the database password ended up on GitHub because .env was committed so new joiners knew which settings to fill in. Please replace that habit: an .env.example that lists the settings with no real secrets, and a .gitignore that keeps the real .env out of Git.",
      "Edit .env.example and .gitignore to meet the requirements below.",
      ["Configuration", "Secrets", "Git hygiene"],
      [
        { name: ".env.example", language: "text", content: "PORT=3000\nDATABASE_URL=postgres://admin:Sup3rS3cret@db.kaarya.internal:5432/kaarya\nJWT_SECRET=kq93hf83hf93hf\n" },
        { name: ".gitignore", language: "text", content: "node_modules/\n" },
      ],
      [
        { kind: "regex", label: ".env.example still lists PORT=3000", file: ".env.example", pattern: "(^|\\n)PORT=3000(\\r?\\n|$)", op: "matches" },
        { kind: "regex", label: ".env.example lists DATABASE_URL", file: ".env.example", pattern: "(^|\\n)DATABASE_URL=", op: "matches" },
        { kind: "regex", label: "DATABASE_URL has no real password (use a placeholder such as postgres://user:password@localhost:5432/kaarya)", file: ".env.example", pattern: "Sup3rS3cret|kaarya\\.internal", op: "not_matches" },
        { kind: "regex", label: "JWT_SECRET is listed but left empty or as a placeholder in angle brackets", file: ".env.example", pattern: "(^|\\n)JWT_SECRET=(<[a-z_-]+>)?(\\r?\\n|$)", op: "matches" },
        { kind: "regex", label: ".gitignore ignores the real .env file", file: ".gitignore", pattern: "(^|\\n)/?\\.env(\\r?\\n|$)", op: "matches" },
        { kind: "regex", label: ".gitignore does not ignore .env.example", file: ".gitignore", pattern: "(^|\\n)/?\\.env\\.example|(^|\\n)\\.env\\*", op: "not_matches" },
      ]),
    solution: [
      { name: ".env.example", content: "PORT=3000\nDATABASE_URL=postgres://user:password@localhost:5432/kaarya\nJWT_SECRET=\n" },
      { name: ".gitignore", content: "node_modules/\n.env\n" },
    ],
  },
  {
    id: "appdev-fullstack-ci", areas: ["build-and-config"], difficulty: "medium", minLevel: "fresher",
    draft: make("Make CI check every pull request before it is merged", LEAD,
      "Hi, our CI only runs when someone remembers to start it by hand, so a pull request with failing tests was merged on Monday and broke the build. Please make the workflow run on every pull request and on pushes to main, check lint and tests, and only build once the checks pass.",
      `Edit ${CI} to meet the requirements below.`,
      ["GitHub Actions", "CI", "YAML"],
      [{ name: CI, language: "yaml", content: "name: CI\non:\n  workflow_dispatch:\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - run: npm install\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - run: npm run build\n" }],
      [
        { kind: "yaml", label: "The workflow runs on every pull request", file: CI, path: "on.pull_request", op: "exists" },
        { kind: "yaml", label: "The workflow runs on pushes to the main branch", file: CI, path: "on.push.branches[*]", op: "equals", value: "main" },
        { kind: "yaml", label: "The test job sets up Node.js 20 with actions/setup-node", file: CI, path: "jobs.test.steps[*].with.node-version", op: "matches", value: "^20" },
        { kind: "yaml", label: "The test job installs dependencies with npm ci (not npm install)", file: CI, path: "jobs.test.steps[*].run", op: "contains", value: "npm ci" },
        { kind: "yaml", label: "The test job runs the linter with npm run lint", file: CI, path: "jobs.test.steps[*].run", op: "contains", value: "npm run lint" },
        { kind: "yaml", label: "The test job runs the tests with npm test", file: CI, path: "jobs.test.steps[*].run", op: "contains", value: "npm test" },
        { kind: "yaml", label: "The build job waits for the test job (needs: test)", file: CI, path: "jobs.build.needs", op: "contains", value: "test" },
      ]),
    solution: [{ name: CI, content: "name: CI\non:\n  pull_request:\n  push:\n    branches: [main]\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-node@v4\n        with:\n          node-version: 20\n      - run: npm ci\n      - run: npm run lint\n      - run: npm test\n  build:\n    needs: test\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - run: npm ci\n      - run: npm run build\n" }],
  },
];
