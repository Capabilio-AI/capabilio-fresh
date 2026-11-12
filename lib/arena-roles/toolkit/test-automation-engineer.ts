import type { RoleToolkit } from "./types";

/** MCA-05 Software Test Automation Engineer. Two shared workstations (W10, W14 in docs/arena-roles/workstation-design.md) with this role's own areas. */
export const TOOLKIT: RoleToolkit = {
  roleKey: "test-automation-engineer",
  roleId: "MCA-05",
  stream: "MCA",
  headline: "Build the helpers and the pipeline around an automated test suite: test data that never collides, boundary cases, a clear summary of a run, a list of flaky tests and a CI gate that blocks a bad release.",
  workstations: [
    {
      name: "Code Editor",
      mirrors: ["VS Code", "IntelliJ IDEA", "Jupyter"],
      toolType: "code_workspace",
      tier: "R",
      runsIn: "browser",
      summary: "Write one Python or JavaScript function to the ticket's spec, run it on the cases in your browser, and submit what it returned.",
    },
    {
      name: "Config Editor",
      mirrors: ["VS Code", "kubectl (manifests)", "Docker", "GitHub Actions"],
      toolType: "devops_workspace",
      tier: "A",
      runsIn: "server",
      summary: "Fix the ticket's files; the server checks the text against its rules. Nothing is built, applied or deployed.",
    },
  ],
  environment: [
    { label: "Runtimes", detail: "Python (Pyodide) and JavaScript run in your browser for the helper tickets; nothing has to be installed on your machine." },
    { label: "Test results", detail: "Small supplied samples of test results, run logs and repeated runs, the shapes a real runner produces." },
    { label: "CI files", detail: "Each CI ticket opens a GitHub Actions workflow; rules are checked on submit and nothing runs." },
  ],
  firstWeek: [
    "Generate fresh signup emails for every test run",
    "List the boundary values of the age field",
    "Summarise a test run without letting skipped tests lower the pass rate",
    "Find which test file fails most in a CI log",
    "List the flaky tests from repeated runs and rank them",
    "Run the tests on two Python versions and keep the report on failure",
  ],
  portfolioArtifacts: [
    "Graded helper tickets with per-case results, the code kept for the explain-your-work interview",
    "Graded CI-workflow tickets with the per-requirement checks that passed",
  ],
  honestLimits: [
    "Code runs in your browser (client-run): the server compares the outputs you submit with its own answers and never runs or reads your code.",
    "You do not write or run tests in a real framework here: no pytest, Jest, Selenium or Playwright runs, and no application is under test.",
    "CI workflows are checked as text; no pipeline runs.",
    "Writing real tests, UI and API automation and test planning are not assessed yet.",
  ],
};
