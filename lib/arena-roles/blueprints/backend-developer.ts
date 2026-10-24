import type { RoleBlueprint } from "../blueprint";

/**
 * IT-02 Backend Developer. Mirrors supabase/migrations/113_backend_role.sql, which is NOT yet applied to production (checked 2026-10-22).
 *
 * What this role really assesses: the student writes ONE pure function (Python or JavaScript) that models an API -- requests in, responses out,
 * state kept inside the function. It runs in the student's browser; the server compares the outputs with its own answers (see tools/code.ts).
 * It is not a real HTTP service, a real database, or a test run, and the competencies below reflect only that.
 */
export const BACKEND_DEVELOPER: RoleBlueprint = {
  roleId: "IT-02",
  domainRoleKey: "backend-developer",
  name: "Backend Developer",
  competencies: [
    { id: "be.api", label: "API design and implementation (routes, status codes, response bodies)" },
    { id: "be.validation", label: "Request validation" },
    { id: "be.logic", label: "Business logic and state handling" },
    { id: "be.authz", label: "Authentication and authorization rules" },
    { id: "be.errors", label: "Error handling" },
    { id: "be.reliability", label: "Reliability patterns (retries, idempotency)" },
    { id: "be.debugging", label: "Finding and fixing defects in handler logic" },
  ],
  unassessed: [
    { id: "be.database", label: "Real database interaction (state is modelled in memory)" },
    { id: "be.tests", label: "Writing automated tests" },
    { id: "be.performance", label: "Performance engineering" },
    { id: "be.docs", label: "API documentation and maintainability" },
  ],
  areas: [
    { areaKey: "rest-api", toolType: "code_workspace", generationVersion: "code.gen.v1", gradingVersion: "code.grade.v1", executionMode: "client-run", status: "enabled", competencies: ["be.api", "be.validation", "be.logic"] },
    { areaKey: "auth-and-security", toolType: "code_workspace", generationVersion: "code.gen.v1", gradingVersion: "code.grade.v1", executionMode: "client-run", status: "enabled", competencies: ["be.authz", "be.validation"] },
    { areaKey: "data-and-state", toolType: "code_workspace", generationVersion: "code.gen.v1", gradingVersion: "code.grade.v1", executionMode: "client-run", status: "enabled", competencies: ["be.logic", "be.reliability"] },
    { areaKey: "error-handling", toolType: "code_workspace", generationVersion: "code.gen.v1", gradingVersion: "code.grade.v1", executionMode: "client-run", status: "enabled", competencies: ["be.errors", "be.reliability"] },
    { areaKey: "backend-debugging", toolType: "code_workspace", generationVersion: "code.gen.v1", gradingVersion: "code.grade.v1", executionMode: "client-run", status: "enabled", competencies: ["be.debugging", "be.errors"] },
  ],
  limitations: [
    "The student's code runs in their own browser; the server checks the answers it returns, not the code. Anyone can produce the right outputs by any means, so the explain-your-work interview is the only check that the student understands their solution.",
    "Tasks model an API as a pure function. There is no real HTTP server, database, authentication stack or test runner, so those skills are listed as unassessed, not claimed.",
    "Fixed template fallbacks hold one problem per area; when the AI generator fails and the title was already served, the same problem can repeat.",
    "A true server-side run of student code needs an isolated executor, which this repository does not have.",
  ],
};
