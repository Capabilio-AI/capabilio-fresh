import type { RoleBlueprint } from "../blueprint";

/**
 * MCA-05 Software Test Automation Engineer. Mirrors supabase/migrations/190_test_automation_engineer_role.sql (not applied).
 * 
 * The helpers and pipeline around an automated test suite, for an MCA fresher: test data, boundary cases, test-result summaries, flaky-test detection and the
 * CI workflow that gates a release. Helper tickets run the student's function in their own browser on the shared code workstation; CI tickets use the shared
 * config workstation (workflow text checked against rules). No test runner or browser is run (lib/workplace/test-automation).
 */
export const TEST_AUTOMATION_ENGINEER: RoleBlueprint = {
  roleId: "MCA-05",
  domainRoleKey: "test-automation-engineer",
  name: "Software Test Automation Engineer",
  competencies: [
    { id: "ta.test-data", label: "Generating test data that does not collide between runs" },
    { id: "ta.boundaries", label: "Boundary value analysis: the values at and around the limits" },
    { id: "ta.reports", label: "Reading test results: totals, pass rate that ignores skipped tests, slowest test" },
    { id: "ta.log-parsing", label: "Finding which test file fails most from a run log" },
    { id: "ta.flaky", label: "Detecting flaky tests and ranking them by failure rate" },
    { id: "ta.ci-gates", label: "CI test gates: version matrix, job ordering, time limits and keeping reports" },
  ],
  unassessed: [
    { id: "ta.write-tests", label: "Writing real automated tests in a framework (pytest, Jest, JUnit)" },
    { id: "ta.ui-automation", label: "UI automation against a running browser (Selenium, Playwright)" },
    { id: "ta.api-testing", label: "API testing against a live service" },
    { id: "ta.test-design", label: "Designing a full test plan from requirements" },
    { id: "ta.running-ci", label: "Running a real CI pipeline" },
  ],
  areas: [
    { areaKey: "sta-test-data", toolType: "code_workspace", generationVersion: "code.gen.v1", gradingVersion: "code.grade.v1", executionMode: "client-run", status: "enabled", competencies: ["ta.test-data", "ta.boundaries"] },
    { areaKey: "sta-report-analysis", toolType: "code_workspace", generationVersion: "code.gen.v1", gradingVersion: "code.grade.v1", executionMode: "client-run", status: "enabled", competencies: ["ta.reports", "ta.log-parsing"] },
    { areaKey: "sta-flaky-tests", toolType: "code_workspace", generationVersion: "code.gen.v1", gradingVersion: "code.grade.v1", executionMode: "client-run", status: "enabled", competencies: ["ta.flaky"] },
    { areaKey: "sta-ci-test-gates", toolType: "devops_workspace", generationVersion: "devops.gen.v1", gradingVersion: "devops.grade.v1", executionMode: "computed-key", status: "enabled", competencies: ["ta.ci-gates"] },
  ],
  limitations: [
    "Helper tickets (test data, boundary values, result summaries, flaky tests) run the student's function in their own browser; the server compares the outputs it is sent with its own answers and never runs or reads the code, so the explain-your-work interview is the only check that the student understands it.",
    "The student does not write or run tests in a real framework here: no pytest, Jest, JUnit, Selenium or Playwright runs, and no application is under test.",
    "CI tickets check GitHub Actions workflow text against rules; no pipeline runs.",
    "Test results and logs are small supplied samples, not output from a real run.",
    "Writing real tests, UI and API automation, test planning and running CI are listed as unassessed.",
    "Tickets come only from fixed templates (no AI-written variants), so a student can meet the same ticket again.",
  ],
};
