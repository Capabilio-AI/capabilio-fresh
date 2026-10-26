import type { RoleBlueprint } from "../blueprint";

/**
 * MCA-01 Application Developer. Mirrors supabase/migrations/132_application_developer_role.sql (not applied).
 *
 * An MCA fresher's first job: small features across one application. Four shared workstations serve it with this role's own areas and templates
 * (lib/workplace/application-developer): code tickets are one function the student runs in their browser (the server compares the outputs, never runs
 * the code); form tickets are HTML the server parses and checks; data-access tickets are SQL run by the server on a SQLite copy of the fictional
 * Kaarya app database; build-and-config tickets are config files checked as text (nothing is built or deployed).
 */
export const APPLICATION_DEVELOPER: RoleBlueprint = {
  roleId: "MCA-01",
  domainRoleKey: "application-developer",
  name: "Application Developer",
  competencies: [
    { id: "ad.logic", label: "Business logic in functions, to a written spec with edge cases" },
    { id: "ad.collections", label: "Working with strings, lists and dictionaries" },
    { id: "ad.api", label: "Request handling: routes, status codes and response bodies" },
    { id: "ad.validation", label: "Input and request validation" },
    { id: "ad.forms", label: "Accessible HTML forms with built-in validation" },
    { id: "ad.ui-state", label: "UI state: filtering lists and applying actions to state" },
    { id: "ad.sql", label: "Data access with SQL: CRUD, joins and aggregation" },
    { id: "ad.constraints", label: "Database constraints that protect data" },
    { id: "ad.config", label: "Build and configuration files (Dockerfile, CI workflow, environment settings)" },
    { id: "ad.debugging", label: "Finding and fixing a defect from a failing case" },
  ],
  unassessed: [
    { id: "ad.git", label: "Git and a real project workflow (branches, pull requests, code review)" },
    { id: "ad.multifile", label: "Working in a multi-file codebase with an IDE, imports and a build" },
    { id: "ad.tests", label: "Writing automated tests or running a test runner" },
    { id: "ad.live-ui", label: "A running UI: JavaScript behaviour, rendering and browser testing" },
    { id: "ad.integration", label: "Connecting layers: an app talking to a real database or HTTP server" },
    { id: "ad.delivery", label: "Building, deploying and running an application" },
  ],
  areas: [
    { areaKey: "functions-and-logic", toolType: "code_workspace", generationVersion: "code.gen.v1", gradingVersion: "code.grade.v1", executionMode: "client-run", status: "enabled", competencies: ["ad.logic", "ad.collections"] },
    { areaKey: "api-handlers", toolType: "code_workspace", generationVersion: "code.gen.v1", gradingVersion: "code.grade.v1", executionMode: "client-run", status: "enabled", competencies: ["ad.api", "ad.validation"] },
    { areaKey: "ui-forms", toolType: "frontend_workspace", generationVersion: "frontend.gen.v1", gradingVersion: "frontend.grade.v1", executionMode: "computed-key", status: "enabled", competencies: ["ad.forms", "ad.validation"] },
    { areaKey: "ui-state", toolType: "code_workspace", generationVersion: "code.gen.v1", gradingVersion: "code.grade.v1", executionMode: "client-run", status: "enabled", competencies: ["ad.ui-state", "ad.collections"] },
    { areaKey: "data-access", toolType: "sql_workspace", generationVersion: "sql.gen.v1", gradingVersion: "sql.grade.v1", executionMode: "executed", status: "enabled", competencies: ["ad.sql", "ad.constraints"] },
    { areaKey: "build-and-config", toolType: "devops_workspace", generationVersion: "devops.gen.v1", gradingVersion: "devops.grade.v1", executionMode: "computed-key", status: "enabled", competencies: ["ad.config"] },
    { areaKey: "app-debugging", toolType: "code_workspace", generationVersion: "code.gen.v1", gradingVersion: "code.grade.v1", executionMode: "client-run", status: "enabled", competencies: ["ad.debugging", "ad.logic"] },
  ],
  limitations: [
    "Code tickets (functions, API handlers, UI state, debugging) run the student's function in their own browser; the server compares the outputs it is sent with its own answers and never runs or reads the code. Anyone can produce the right outputs by any means, so the explain-your-work interview is the only check that the student understands their solution.",
    "API handlers are modelled as one pure function (requests in, responses out). There is no real HTTP server, framework or database behind them.",
    "UI state is assessed as the logic a component would call (filter, reducer), not a rendered, clickable UI. Form tickets check the HTML structure and attributes; the page and any JavaScript are never run.",
    "Data-access tickets are real SQL run by the server on a fresh SQLite copy of the Kaarya app database, not PostgreSQL or the app's own data layer (no ORM, transactions across requests or migrations tooling).",
    "Build-and-config tickets check Dockerfile, CI workflow and environment files as text against rules; no image is built and no pipeline runs.",
    "Each ticket is a separate small task in one file or one query, not one growing multi-file project; Git, an IDE project, automated tests and deployment are listed as unassessed.",
    "Tickets come only from fixed templates (no AI-written variants) for the code, frontend and config areas, so a student can meet the same ticket again.",
  ],
};
