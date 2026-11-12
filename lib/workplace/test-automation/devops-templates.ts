import type { DevopsTemplate } from "../devops/tickets";
import { make } from "../application-developer/devops-templates";

/** Software Test Automation Engineer CI tickets for the shared config workstation: the server checks the workflow text against rules; no pipeline runs. */
const QA = { name: "Joseph Thomas", title: "QA Lead" };
const RELEASE = { name: "Neha Kulkarni", title: "Release Manager" };
const CI = ".github/workflows/tests.yml";

export const TEST_AUTOMATION_DEVOPS_TEMPLATES: DevopsTemplate[] = [
  {
    id: "sta-python-version-matrix", areas: ["sta-ci-test-gates"], difficulty: "easy", minLevel: "fresher",
    draft: make("Run the tests on every supported Python version", QA,
      "Hi, the library supports Python 3.11 and 3.12 but CI only tests one version, so a 3.12-only failure reached a customer. Please run the tests on both versions, let one version finish even if the other fails, and keep the report when tests fail so we can read it.",
      `Edit ${CI} to meet the requirements below.`,
      ["GitHub Actions", "Test matrix", "pytest"],
      [{ name: CI, language: "yaml", content: "name: tests\non:\n  pull_request:\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-python@v5\n        with:\n          python-version: \"3.12\"\n      - run: pip install -r requirements.txt\n      - run: pytest --junitxml=report.xml\n" }],
      [
        { kind: "yaml", label: "The workflow runs on every pull request", file: CI, path: "on.pull_request", op: "exists" },
        { kind: "yaml", label: "The test job has a matrix that includes Python 3.11", file: CI, path: "jobs.test.strategy.matrix.python-version", op: "contains", value: "3.11" },
        { kind: "yaml", label: "The test job has a matrix that includes Python 3.12", file: CI, path: "jobs.test.strategy.matrix.python-version", op: "contains", value: "3.12" },
        { kind: "yaml", label: "One failing version does not cancel the others (fail-fast: false)", file: CI, path: "jobs.test.strategy.fail-fast", op: "equals", value: false },
        { kind: "yaml", label: "setup-python takes its version from the matrix", file: CI, path: "jobs.test.steps[*].with.python-version", op: "contains", value: "matrix.python-version" },
        { kind: "yaml", label: "The test report is uploaded with actions/upload-artifact", file: CI, path: "jobs.test.steps[*].uses", op: "contains", value: "actions/upload-artifact" },
        { kind: "yaml", label: "The report is uploaded even when the tests fail (if: always())", file: CI, path: "jobs.test.steps[*].if", op: "contains", value: "always()" },
      ]),
    solution: [{ name: CI, content: "name: tests\non:\n  pull_request:\njobs:\n  test:\n    runs-on: ubuntu-latest\n    strategy:\n      fail-fast: false\n      matrix:\n        python-version: [\"3.11\", \"3.12\"]\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-python@v5\n        with:\n          python-version: ${{ matrix.python-version }}\n      - run: pip install -r requirements.txt\n      - run: pytest --junitxml=report.xml\n      - if: always()\n        uses: actions/upload-artifact@v4\n        with:\n          name: report-${{ matrix.python-version }}\n          path: report.xml\n" }],
  },
  {
    id: "sta-e2e-merge-gate", areas: ["sta-ci-test-gates"], difficulty: "medium", minLevel: "fresher",
    draft: make("Make the browser tests a proper gate before release", RELEASE,
      "Hello, the browser (end-to-end) tests start at the same time as the fast unit tests, hang forever when the site is down and have blocked the release queue twice. Please run them only after the unit tests pass, give them a time limit, run them on pushes to main as well as on pull requests, and keep the Playwright report when they fail.",
      `Edit ${CI} to meet the requirements below.`,
      ["GitHub Actions", "End-to-end tests", "Playwright"],
      [{ name: CI, language: "yaml", content: "name: tests\non:\n  workflow_dispatch:\njobs:\n  unit:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - run: npm ci\n      - run: npm test\n  e2e:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - run: npm ci\n      - run: npx playwright install --with-deps\n      - run: npx playwright test\n" }],
      [
        { kind: "yaml", label: "The workflow runs on every pull request", file: CI, path: "on.pull_request", op: "exists" },
        { kind: "yaml", label: "The workflow runs on pushes to the main branch", file: CI, path: "on.push.branches[*]", op: "equals", value: "main" },
        { kind: "yaml", label: "The e2e job waits for the unit job (needs: unit)", file: CI, path: "jobs.e2e.needs", op: "contains", value: "unit" },
        { kind: "yaml", label: "The e2e job has a time limit of 20 minutes or less (timeout-minutes)", file: CI, path: "jobs.e2e.timeout-minutes", op: "matches", value: "^([1-9]|1\\d|20)$" },
        { kind: "yaml", label: "The e2e job runs the tests with npx playwright test", file: CI, path: "jobs.e2e.steps[*].run", op: "contains", value: "npx playwright test" },
        { kind: "yaml", label: "The Playwright report is uploaded with actions/upload-artifact", file: CI, path: "jobs.e2e.steps[*].uses", op: "contains", value: "actions/upload-artifact" },
        { kind: "yaml", label: "The report is uploaded even when the tests fail (if: always())", file: CI, path: "jobs.e2e.steps[*].if", op: "contains", value: "always()" },
      ]),
    solution: [{ name: CI, content: "name: tests\non:\n  pull_request:\n  push:\n    branches: [main]\njobs:\n  unit:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - run: npm ci\n      - run: npm test\n  e2e:\n    needs: unit\n    runs-on: ubuntu-latest\n    timeout-minutes: 15\n    steps:\n      - uses: actions/checkout@v4\n      - run: npm ci\n      - run: npx playwright install --with-deps\n      - run: npx playwright test\n      - if: always()\n        uses: actions/upload-artifact@v4\n        with:\n          name: playwright-report\n          path: playwright-report/\n" }],
  },
];
