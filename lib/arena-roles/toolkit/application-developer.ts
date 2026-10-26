import type { RoleToolkit } from "./types";

/** MCA-01 Application Developer. Four shared workstations (W10, W13, W01, W14 in docs/arena-roles/workstation-design.md) with this role's own areas. */
export const TOOLKIT: RoleToolkit = {
  roleKey: "application-developer",
  roleId: "MCA-01",
  stream: "MCA",
  headline: "Ship the small features a new application developer is handed: the logic, the request handling, the form, the query and the config around them.",
  workstations: [
    {
      name: "Code Editor",
      mirrors: ["VS Code", "IntelliJ IDEA", "Postman (request/response thinking)"],
      toolType: "code_workspace",
      tier: "R",
      runsIn: "browser",
      summary: "Write one Python or JavaScript function to the ticket's spec, run it on the cases in your browser, and submit what it returned.",
    },
    {
      name: "Form Builder",
      mirrors: ["VS Code", "Chrome DevTools", "axe"],
      toolType: "frontend_workspace",
      tier: "A",
      runsIn: "server",
      summary: "Edit the form's HTML with a live preview; the server parses it and checks labels, input types, validation attributes and ARIA.",
    },
    {
      name: "SQL Console",
      mirrors: ["DBeaver", "DB Browser for SQLite", "pgAdmin"],
      toolType: "sql_workspace",
      tier: "R",
      runsIn: "server",
      summary: "Query and change your own copy of the Kaarya app database; the server runs your SQL and checks the result or the data it leaves behind.",
    },
    {
      name: "Config Editor",
      mirrors: ["VS Code", "Docker", "GitHub Actions"],
      toolType: "devops_workspace",
      tier: "A",
      runsIn: "server",
      summary: "Fix a Dockerfile, a CI workflow or the environment files; the server checks the text against the ticket's rules.",
    },
  ],
  environment: [
    { label: "IDE-like editors", detail: "Syntax highlighting and the ticket's starting files open in the browser. No install, no project setup." },
    { label: "Runtimes", detail: "Python (Pyodide) and JavaScript run in your browser for code tickets; nothing has to be installed on your machine." },
    { label: "App database", detail: "Kaarya, a fictional task-tracking app: users, projects and tasks in SQLite, a fresh copy for every ticket." },
    { label: "Config files", detail: "Each config ticket opens its Dockerfile, workflow or .env files; YAML and Dockerfile rules are checked on submit." },
  ],
  firstWeek: [
    "Clean up the mobile numbers people type at signup",
    "Validate the signup request before it is saved",
    "Build the signup form from the spec with labels and built-in validation",
    "Make the product search box and stock toggle work",
    "Show overdue tasks per person from the app database",
    "Fix the Flask API's Dockerfile",
    "Find and fix why users cannot turn dark mode off",
  ],
  portfolioArtifacts: [
    "Graded code tickets with per-case results, the code kept for the explain-your-work interview",
    "Graded form, SQL and config tickets with the per-requirement checks that passed",
  ],
  honestLimits: [
    "Code runs in your browser (client-run): the server compares the outputs you submit with its own answers and never runs or reads your code.",
    "Each ticket is one function, one file or one query, not a multi-file project; working in a real IDE project is not assessed yet.",
    "Git and a real project workflow (branches, pull requests, code review) are not assessed yet.",
    "Automated tests and test runners are not assessed; your function is checked on hidden cases instead.",
    "Form pages and their JavaScript are never run; only the HTML structure and attributes are checked.",
    "Config files are checked as text: no image is built, no pipeline runs and nothing is deployed.",
    "SQL runs on SQLite, not the PostgreSQL or ORM a real app might use.",
  ],
};
