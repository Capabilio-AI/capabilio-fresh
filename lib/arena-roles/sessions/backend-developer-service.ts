import type { ProofSessionSpec, SessionStage } from "./data-analyst-story";

// Each stage is one of the Backend Developer's own skill areas, served by the shared code workstation: the student writes one function that models the
// API (requests in, responses out) and the server compares its answers with its own. See blueprints/backend-developer.ts for what that does and does not prove.
const STAGES: SessionStage[] = [
  { key: "build", areaKey: "rest-api", title: "Build the endpoint", goal: "Model the API from the ticket: the routes, request validation, status codes and response bodies." },
  { key: "secure", areaKey: "auth-and-security", title: "Lock it down", goal: "Add the access rules: who may call what, and what an unauthorised call gets back." },
  { key: "state", areaKey: "data-and-state", title: "Keep the state right", goal: "Make repeated and overlapping requests safe: no duplicates, no leaked or shared state." },
  { key: "failure", areaKey: "error-handling", title: "Handle failure", goal: "Decide what happens when things go wrong: retries, limits and the errors callers see." },
  { key: "debug", areaKey: "backend-debugging", title: "Find the bug", goal: "Find and fix the defect in a handler that returns the wrong answer for one case." },
];

export const BACKEND_SERVICE: ProofSessionSpec = {
  key: "be-api-service",
  version: 1,
  roleId: "IT-02",
  domainRoleKey: "backend-developer",
  title: "Build, secure, harden and debug a small API",
  worldKey: "none",
  claimSubject: "a simulated backend API work session",
  intro: "One connected piece of backend work in five stages: build an endpoint, lock it down, keep its state right, handle failure, and find a bug. Each stage is an API modelled as a function that you write and run in your browser. About an hour or two. You explain your work at the end.",
  stagesFor: () => STAGES,
  limitations: [
    "Your code runs in your own browser; the server checks the answers it returns, not the code. Each stage is a separate exercise, not one growing service.",
    "The API is modelled as a function. There is no real HTTP server, database, authentication stack or test runner here, so those skills are not assessed.",
    "Activity signals such as reading the brief or writing a plan are reported by the browser and can be faked; they are marked lower-confidence.",
    "Dimension levels describe what the session log shows. They never decide pass or fail.",
  ],
};
