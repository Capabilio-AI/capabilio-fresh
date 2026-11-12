import type { RoleToolkit } from "./types";

/** MCA-03 Database and Data Applications Engineer. Two shared workstations (W01, W10 in docs/arena-roles/workstation-design.md) with this role's own areas. */
export const TOOLKIT: RoleToolkit = {
  roleKey: "data-applications-engineer",
  roleId: "MCA-03",
  stream: "MCA",
  headline: "Do the data work an application team hands a new engineer: add a table that protects its data, answer a report question, fix rows safely and import a file without duplicates.",
  workstations: [
    {
      name: "SQL Console",
      mirrors: ["DBeaver", "DB Browser for SQLite", "pgAdmin"],
      toolType: "sql_workspace",
      tier: "R",
      runsIn: "server",
      summary: "Run scripts and queries on your own copy of the Kaarya app database; the server runs your SQL and checks the result or the data it leaves behind.",
    },
    {
      name: "Code Editor",
      mirrors: ["VS Code", "IntelliJ IDEA", "Jupyter"],
      toolType: "code_workspace",
      tier: "R",
      runsIn: "browser",
      summary: "Write one Python or JavaScript function to the ticket's spec, run it on the cases in your browser, and submit what it returned.",
    },
  ],
  environment: [
    { label: "App database", detail: "Kaarya, a fictional task-tracking app: users, projects and tasks in SQLite, a fresh copy for every ticket." },
    { label: "Runtimes", detail: "Python (Pyodide) and JavaScript run in your browser for the data-layer tickets; nothing has to be installed on your machine." },
    { label: "Checks", detail: "Schema and data-fix tickets are graded by probe queries on the database your script leaves behind." },
  ],
  firstWeek: [
    "Create the table for task comments, with keys and an index",
    "Find the people who have no task assigned",
    "Close a cancelled project's open tasks without touching anything else",
    "Import the planning sheet without creating duplicate projects",
    "Archive finished tasks so no task is lost",
    "Write the pagination helper for the customer list",
  ],
  portfolioArtifacts: [
    "Graded SQL tickets with the probe results that passed, and the script kept for the explain-your-work interview",
    "Graded data-layer code tickets with per-case results",
  ],
  honestLimits: [
    "SQL runs on SQLite, not PostgreSQL: transactions across requests, locking and EXPLAIN plans are not assessed.",
    "Code runs in your browser (client-run): the server compares the outputs you submit with its own answers and never runs or reads your code.",
    "Each ticket is one script, one query or one function; migration tools, ORMs, backups and a live connection pool are not assessed yet.",
  ],
};
