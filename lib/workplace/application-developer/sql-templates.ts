import type { Probe, ScriptDraft, TicketTemplate } from "../tickets/types";

/** Data-access tickets on the Kaarya app database (world.ts): the CRUD, joins and one constraint a fresher application developer writes. */
const CAST = {
  product: { name: "Neha Kulkarni", title: "Product Manager" },
  lead: { name: "Aditya Rao", title: "Tech Lead" },
  support: { name: "Farah Sheikh", title: "Customer Support Lead" },
};
const probe = (label: string, sql: string, compare = true): Probe => ({ label, sql, compare });
const DONE = "SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END)";

const defs = {
  overdue: { id: "appdev-overdue-high-priority", difficulty: "easy", minLevel: "fresher", taskKind: "retrieval", areas: ["data-access"] },
  unassign: { id: "appdev-unassign-deactivated", difficulty: "easy", minLevel: "fresher", taskKind: "update", areas: ["data-access"] },
  create: { id: "appdev-create-project", difficulty: "easy", minLevel: "fresher", taskKind: "update", areas: ["data-access"] },
  progress: { id: "appdev-project-progress", difficulty: "medium", minLevel: "fresher", taskKind: "analytics", areas: ["data-access"] },
  unique: { id: "appdev-unique-email", difficulty: "medium", minLevel: "fresher", taskKind: "constraint", areas: ["data-access"] },
} as const satisfies Record<string, Omit<TicketTemplate, "build">>;

type ScriptParts = Omit<ScriptDraft, "kind" | "templateId" | "difficulty" | "minLevel" | "taskKind">;
const script = (d: (typeof defs)[keyof typeof defs], parts: ScriptParts): ScriptDraft => ({ kind: "script", templateId: d.id, difficulty: d.difficulty, minLevel: d.minLevel, taskKind: d.taskKind, ...parts });

export const APP_DEV_SQL_TEMPLATES: TicketTemplate[] = [
  {
    ...defs.overdue,
    areas: [...defs.overdue.areas],
    build(rng) {
      const today = rng.pick(["2026-06-01", "2026-07-01", "2026-08-01"]);
      const where = `t.priority = 1 AND t.status <> 'done' AND t.due_date < '${today}'`;
      return {
        kind: "query", templateId: defs.overdue.id, difficulty: "easy", minLevel: "fresher", taskKind: "retrieval",
        title: `Overdue high-priority tasks per person on ${today}`,
        requester: CAST.product,
        scenario: `Hi, we are adding an "overdue" badge to the team page and I need the numbers it should show. Treat ${today} as today. Only high-priority tasks count, and a task that is already done is never overdue, whatever its date.`,
        deliverable: `One row per assignee with name and overdue_tasks: the number of tasks assigned to them with priority 1, a status other than 'done' and a due_date before ${today}. Leave out unassigned tasks and people with none.`,
        referenceQuery: `SELECT u.name, COUNT(*) AS overdue_tasks FROM tasks t JOIN users u ON u.user_id = t.assignee_id WHERE ${where} GROUP BY u.user_id, u.name`,
        mistakeQuery: `SELECT u.name, COUNT(*) AS overdue_tasks FROM tasks t JOIN users u ON u.user_id = t.assignee_id WHERE t.priority = 1 AND t.due_date < '${today}' GROUP BY u.user_id, u.name`,
        skillTags: ["SQL", "JOIN", "GROUP BY"],
      };
    },
  },
  {
    ...defs.unassign,
    areas: [...defs.unassign.areas],
    build() {
      return script(defs.unassign, {
        title: "Free up tasks held by deactivated accounts",
        requester: CAST.support,
        scenario: "Hi, when someone leaves a customer's team their account is deactivated, but their open tasks stay assigned to them and nobody picks them up. Please unassign those tasks so they show up in the 'needs an owner' list. Finished tasks must keep their assignee, we use them for reports.",
        deliverable: "Write an UPDATE that sets assignee_id to NULL on every task whose status is not 'done' and whose assignee is a user with is_active = 0. Nothing else may change.",
        referenceScript: "UPDATE tasks SET assignee_id = NULL WHERE status <> 'done' AND assignee_id IN (SELECT user_id FROM users WHERE is_active = 0);",
        mistakeScript: "UPDATE tasks SET assignee_id = NULL WHERE assignee_id IN (SELECT user_id FROM users WHERE is_active = 0);",
        probes: [
          probe("No open task is still assigned to a deactivated user", "SELECT COUNT(*) AS still_assigned FROM tasks t JOIN users u ON u.user_id = t.assignee_id WHERE u.is_active = 0 AND t.status <> 'done'"),
          probe("Done tasks and active users' tasks kept their assignee", "SELECT status, COUNT(assignee_id) AS assigned, COUNT(*) AS total FROM tasks GROUP BY status"),
        ],
        previewQuery: "SELECT status, COUNT(assignee_id) AS assigned, COUNT(*) - COUNT(assignee_id) AS unassigned FROM tasks GROUP BY status",
        skillTags: ["SQL", "UPDATE", "Subqueries"],
      });
    },
  },
  {
    ...defs.create,
    areas: [...defs.create.areas],
    build(rng) {
      const owner = rng.int(1, 24);
      const name = rng.pick(["Referral programme", "Dark mode", "Invoice reminders", "Team calendar"]);
      const due = rng.pick(["2026-10-15", "2026-10-31", "2026-11-15"]);
      const titles = ["Write the spec", "Build the screen", "Test and release"];
      const values = titles.map((t, i) => `(${91 + i}, 9, NULL, '${t}', 'todo', 2, '${due}')`).join(", ");
      return script(defs.create, {
        title: `Set up the "${name}" project with its first tasks`,
        requester: CAST.lead,
        scenario: `Hi, the "${name}" feature was approved this morning. Before the admin screen for creating projects exists, please add it straight to the database so the team can start tracking work today.`,
        deliverable: `Insert a project with project_id 9, owner_id ${owner}, name '${name}' and created_at '2026-10-01'. Then insert its three tasks with task_id 91, 92 and 93, titled '${titles.join("', '")}' in that order: each in project 9, unassigned (assignee_id NULL), status 'todo', priority 2 and due_date '${due}'.`,
        referenceScript: `INSERT INTO projects (project_id, owner_id, name, created_at) VALUES (9, ${owner}, '${name}', '2026-10-01');\nINSERT INTO tasks (task_id, project_id, assignee_id, title, status, priority, due_date) VALUES ${values};`,
        mistakeScript: `INSERT INTO tasks (task_id, project_id, assignee_id, title, status, priority, due_date) VALUES ${values};`,
        probes: [
          probe("The new project exists with the right owner", "SELECT project_id, owner_id, name, created_at FROM projects WHERE project_id = 9"),
          probe("The project has its three tasks with the right values", "SELECT p.name, t.task_id, t.title, t.assignee_id, t.status, t.priority, t.due_date FROM projects p JOIN tasks t ON t.project_id = p.project_id WHERE p.project_id = 9 ORDER BY t.task_id"),
          probe("No other project or task changed", "SELECT COUNT(*) AS projects, (SELECT COUNT(*) FROM tasks) AS tasks FROM projects"),
        ],
        previewQuery: "SELECT p.project_id, p.name, COUNT(t.task_id) AS tasks FROM projects p LEFT JOIN tasks t ON t.project_id = p.project_id GROUP BY p.project_id, p.name ORDER BY p.project_id",
        skillTags: ["SQL", "INSERT", "CRUD"],
      });
    },
  },
  {
    ...defs.progress,
    areas: [...defs.progress.areas],
    build() {
      return {
        kind: "query", templateId: defs.progress.id, difficulty: "medium", minLevel: "fresher", taskKind: "analytics",
        title: "Progress bars for the projects page",
        requester: CAST.product,
        scenario: "Hello, the new projects page shows a progress bar for each project. The design shows one decimal place, like 41.7%, and the first version of the API showed 41 for everything because of a rounding problem. Please give me the query the API should use.",
        deliverable: "One row per project that has tasks, ordered by project_id: name, total_tasks, done_tasks (tasks with status 'done') and percent_done (done_tasks as a percentage of total_tasks, rounded to 1 decimal place).",
        referenceQuery: `SELECT p.name, COUNT(t.task_id) AS total_tasks, ${DONE} AS done_tasks, ROUND(100.0 * ${DONE} / COUNT(t.task_id), 1) AS percent_done FROM projects p JOIN tasks t ON t.project_id = p.project_id GROUP BY p.project_id, p.name ORDER BY p.project_id`,
        mistakeQuery: `SELECT p.name, COUNT(t.task_id) AS total_tasks, ${DONE} AS done_tasks, 100 * ${DONE} / COUNT(t.task_id) AS percent_done FROM projects p JOIN tasks t ON t.project_id = p.project_id GROUP BY p.project_id, p.name ORDER BY p.project_id`,
        skillTags: ["SQL", "JOIN", "Aggregation", "Integer division"],
      };
    },
  },
  {
    ...defs.unique,
    areas: [...defs.unique.areas],
    build() {
      const twinEmail = "(SELECT LOWER(email) FROM users WHERE user_id = 1)";
      return script(defs.unique, {
        title: "Stop people signing up twice with the same email",
        requester: CAST.lead,
        scenario: "Hi, a customer signed up twice, once typing their email in capitals, and now password resets go to the wrong account. The signup code only checked the exact text. Please clean up the duplicate and make the database itself refuse a repeat, whatever the capitals.",
        deliverable: "Exactly one email appears twice in users if you ignore case. Delete the newer of the two accounts (the higher user_id; it owns no projects and has no tasks). Then create a unique index on users so that no two rows can have the same email ignoring case (index LOWER(email)).",
        referenceScript: "DELETE FROM users WHERE user_id IN (SELECT b.user_id FROM users a JOIN users b ON LOWER(a.email) = LOWER(b.email) AND b.user_id > a.user_id);\nCREATE UNIQUE INDEX users_email_unique ON users (LOWER(email));",
        mistakeScript: "CREATE UNIQUE INDEX users_email_unique ON users (email);",
        probes: [
          probe("Only the duplicate account was deleted", "SELECT COUNT(*) AS users, MIN(user_id) AS first_id FROM users"),
          probe("try to sign up again with an existing email in capitals", `INSERT OR IGNORE INTO users VALUES (99, 'Repeat', UPPER(${twinEmail}), 'Pune', '2026-10-01', 1)`, false),
          probe("The database refuses an email that differs only in capitals", `SELECT COUNT(*) AS accounts FROM users WHERE LOWER(email) = ${twinEmail}`),
        ],
        previewQuery: "SELECT LOWER(email) AS email, COUNT(*) AS accounts FROM users GROUP BY LOWER(email) HAVING COUNT(*) > 1",
        skillTags: ["SQL", "Constraints", "Unique index", "DELETE"],
      });
    },
  },
];
