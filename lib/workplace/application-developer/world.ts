import type { Cell, Dataset } from "@/lib/arena-workstations/engines/dataset";
import type { World } from "../worlds";
import { makeRng } from "../rng";
import { APP_DEV_SQL_TEMPLATES } from "./sql-templates";

/** Kaarya: a fictional Indian task-tracking app. The Application Developer's data-access tickets run on its own app database, one copy per user. */
const FIRST = ["Asha", "Bharat", "Chitra", "Deepak", "Esha", "Gopal", "Hema", "Imran", "Jyoti", "Kiran", "Lata", "Mohan", "Nandini", "Prakash", "Rekha", "Suresh", "Tanvi", "Vivek"];
const LAST = ["Sharma", "Reddy", "Nair", "Iyer", "Khan", "Gupta", "Patel", "Das", "Menon", "Joshi"];
const CITIES = ["Pune", "Bengaluru", "Hyderabad", "Chennai", "Kochi", "Indore"];
const PROJECTS = ["Website revamp", "Mobile app v2", "Payroll export", "Onboarding emails", "Inventory sync", "Support portal", "Billing fixes", "Analytics events"];
const TASKS = ["Write API spec", "Build login form", "Fix date bug", "Add search", "Review PR", "Update README", "Write tests", "Design schema", "Add pagination", "Deploy to staging", "Handle errors", "Clean old data"];

const USERS = 24;
const TASK_COUNT = 90;
const pad = (n: number) => String(n).padStart(2, "0");
const dateOf = (day: number) => {
  const d = new Date(Date.UTC(2026, 0, 1 + day));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};
const emailOf = (name: string, id: number) => `${name.toLowerCase().replace(" ", ".")}${id}@kaarya.in`;

/**
 * Pure and deterministic. users, projects and tasks, with realistic gaps: some users are inactive, some tasks unassigned or overdue, and one user
 * signed up twice with the same email in different case (the constraint ticket must clean it up). The duplicate owns no project and has no tasks.
 */
export function generateKaarya(seed: number): Dataset[] {
  const rng = makeRng(seed);
  const users: Cell[][] = [];
  for (let id = 1; id <= USERS; id++) {
    const name = `${rng.pick(FIRST)} ${rng.pick(LAST)}`;
    users.push([id, name, emailOf(name, id), rng.pick(CITIES), dateOf(rng.int(0, 120)), rng.chance(0.8) ? 1 : 0]);
  }
  const twin = users[rng.int(0, USERS - 1)];
  users.push([USERS + 1, twin[1], String(twin[2]).toUpperCase(), twin[3], dateOf(rng.int(121, 150)), 1]);

  const projects: Cell[][] = PROJECTS.map((name, i) => [i + 1, rng.int(1, USERS), name, dateOf(rng.int(0, 60))]);
  const tasks: Cell[][] = [];
  for (let id = 1; id <= TASK_COUNT; id++) {
    const status = rng.weighted([["todo", 4], ["in_progress", 3], ["done", 5]]);
    tasks.push([id, rng.int(1, PROJECTS.length), rng.chance(0.85) ? rng.int(1, USERS) : null, rng.pick(TASKS), status, rng.int(1, 3), dateOf(rng.int(60, 270))]);
  }
  return [
    { name: "users", columns: [{ name: "user_id", type: "number" }, { name: "name", type: "text" }, { name: "email", type: "text" }, { name: "city", type: "text" }, { name: "signup_date", type: "date" }, { name: "is_active", type: "number", description: "1 active, 0 deactivated" }], rows: users },
    { name: "projects", columns: [{ name: "project_id", type: "number" }, { name: "owner_id", type: "number" }, { name: "name", type: "text" }, { name: "created_at", type: "date" }], rows: projects },
    { name: "tasks", columns: [{ name: "task_id", type: "number" }, { name: "project_id", type: "number" }, { name: "assignee_id", type: "number", description: "null when unassigned" }, { name: "title", type: "text" }, { name: "status", type: "text", description: "todo, in_progress or done" }, { name: "priority", type: "number", description: "1 high, 2 normal, 3 low" }, { name: "due_date", type: "date" }], rows: tasks },
  ];
}

const STORIES = [
  { title: "Release week", blurb: "The next Kaarya release ships on Friday. Small features, a few bug fixes and the data they touch all need to be right." },
  { title: "Cleaning up after the beta", blurb: "Beta users left messy data and rough edges behind. The team wants them fixed before paying customers arrive." },
];

/** SQLite on purpose: data-access tickets for a fresher are plain CRUD, joins and one constraint, and SQLite runs them instantly. */
export const KAARYA_WORLD: World = { key: "kaarya", name: "Kaarya", engine: "sqlite", generate: generateKaarya, templates: APP_DEV_SQL_TEMPLATES, stories: STORIES };
