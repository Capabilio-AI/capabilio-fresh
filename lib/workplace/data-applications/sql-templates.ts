import type { Probe, ScriptDraft, TicketTemplate } from "../tickets/types";

/**
 * Database and Data Applications Engineer tickets on the Kaarya app database (lib/workplace/application-developer/world.ts): the schema changes,
 * reports and data fixes a fresher on the data side of an application is handed. SQLite, run by the server on one copy per user.
 */
const CAST = {
  lead: { name: "Aditya Rao", title: "Tech Lead" },
  product: { name: "Neha Kulkarni", title: "Product Manager" },
  support: { name: "Farah Sheikh", title: "Customer Support Lead" },
};
const probe = (label: string, sql: string, compare = true): Probe => ({ label, sql, compare });

const defs = {
  comments: { id: "dda-task-comments-table", difficulty: "easy", minLevel: "fresher", taskKind: "constraint", areas: ["dda-schema-design"] },
  archive: { id: "dda-archive-done-tasks", difficulty: "medium", minLevel: "fresher", taskKind: "update", areas: ["dda-schema-design"] },
  idle: { id: "dda-users-without-tasks", difficulty: "easy", minLevel: "fresher", taskKind: "retrieval", areas: ["dda-reports"] },
  backlog: { id: "dda-projects-open-heavy", difficulty: "medium", minLevel: "fresher", taskKind: "analytics", areas: ["dda-reports"] },
  close: { id: "dda-close-project", difficulty: "easy", minLevel: "fresher", taskKind: "update", areas: ["dda-data-fixes"] },
  upsert: { id: "dda-upsert-projects", difficulty: "medium", minLevel: "fresher", taskKind: "update", areas: ["dda-data-fixes"] },
} as const satisfies Record<string, Omit<TicketTemplate, "build">>;

type ScriptParts = Omit<ScriptDraft, "kind" | "templateId" | "difficulty" | "minLevel" | "taskKind">;
const script = (d: (typeof defs)[keyof typeof defs], parts: ScriptParts): ScriptDraft => ({ kind: "script", templateId: d.id, difficulty: d.difficulty, minLevel: d.minLevel, taskKind: d.taskKind, ...parts });

const PROJECT_NAMES = ["Website revamp", "Mobile app v2", "Payroll export", "Onboarding emails", "Inventory sync", "Support portal", "Billing fixes", "Analytics events"];

export const DATA_APPS_SQL_TEMPLATES: TicketTemplate[] = [
  {
    ...defs.comments,
    areas: [...defs.comments.areas],
    build(rng) {
      const task = rng.int(1, 90);
      const author = rng.int(1, 24);
      const body = rng.pick(["Blocked on the API spec", "Ready for review", "Needs a design decision"]);
      return script(defs.comments, {
        title: "Create the table for task comments",
        requester: CAST.lead,
        scenario: "Hi, the next release lets people comment on a task. Before the screen is built I need the table, designed so a comment can never point at a task or a person that does not exist, and so loading all comments of one task is fast.",
        deliverable: `Create a table task_comments with columns comment_id (integer primary key), task_id (integer, required, references tasks), author_id (integer, required, references users), body (text, required) and created_at (text, required), in that order. Create an index on task_comments (task_id). Then insert one comment: comment_id 1 on task ${task} by user ${author} with the body '${body}' and created_at '2026-10-01'.`,
        referenceScript: `CREATE TABLE task_comments (comment_id INTEGER PRIMARY KEY, task_id INTEGER NOT NULL REFERENCES tasks(task_id), author_id INTEGER NOT NULL REFERENCES users(user_id), body TEXT NOT NULL, created_at TEXT NOT NULL);\nCREATE INDEX task_comments_task_idx ON task_comments (task_id);\nINSERT INTO task_comments VALUES (1, ${task}, ${author}, '${body}', '2026-10-01');`,
        mistakeScript: `CREATE TABLE task_comments (comment_id INTEGER PRIMARY KEY, task_id INTEGER, author_id INTEGER, body TEXT, created_at TEXT);\nINSERT INTO task_comments VALUES (1, ${task}, ${author}, '${body}', '2026-10-01');`,
        probes: [
          probe("The table has the right columns in order", "SELECT name, type, \"notnull\" FROM pragma_table_info('task_comments') ORDER BY cid"),
          probe("task_id and author_id are foreign keys to the right tables", "SELECT \"table\", \"from\" FROM pragma_foreign_key_list('task_comments') ORDER BY \"from\""),
          probe("task_id is indexed", "SELECT COUNT(*) AS indexes_on_task_id FROM pragma_index_list('task_comments') il JOIN pragma_index_info(il.name) ii WHERE ii.name = 'task_id'"),
          probe("The comment was inserted", "SELECT comment_id, task_id, author_id, body, created_at FROM task_comments"),
        ],
        previewQuery: "SELECT name, type, \"notnull\" AS required FROM pragma_table_info('task_comments') ORDER BY cid",
        skillTags: ["SQL", "CREATE TABLE", "Foreign keys", "Indexes"],
      });
    },
  },
  {
    ...defs.archive,
    areas: [...defs.archive.areas],
    build(rng) {
      const cutoff = rng.pick(["2026-05-01", "2026-06-15", "2026-08-01"]);
      return script(defs.archive, {
        title: `Archive finished tasks older than ${cutoff}`,
        requester: CAST.product,
        scenario: `Hi, the task list is getting slow because of finished work nobody looks at. Please move every finished task due before ${cutoff} into an archive table, so reports can still reach it, and remove them from the live table. Nothing may be lost: every task must be in exactly one of the two tables afterwards.`,
        deliverable: `Create archived_tasks with the same columns as tasks, copy into it every task with status 'done' and a due_date before ${cutoff}, then delete exactly those tasks from tasks. Unfinished tasks and finished tasks due on or after ${cutoff} stay where they are.`,
        referenceScript: `CREATE TABLE archived_tasks AS SELECT * FROM tasks WHERE status = 'done' AND due_date < '${cutoff}';\nDELETE FROM tasks WHERE status = 'done' AND due_date < '${cutoff}';`,
        mistakeScript: `DELETE FROM tasks WHERE status = 'done' AND due_date < '${cutoff}';`,
        probes: [
          probe("Every task is in exactly one table", "SELECT (SELECT COUNT(*) FROM tasks) + (SELECT COUNT(*) FROM archived_tasks) AS total_tasks, (SELECT COUNT(*) FROM archived_tasks) AS archived"),
          probe("The archive holds only old finished tasks", `SELECT COUNT(*) AS wrong_rows FROM archived_tasks WHERE status <> 'done' OR due_date >= '${cutoff}'`),
          probe("No old finished task is left in the live table", `SELECT COUNT(*) AS left_behind FROM tasks WHERE status = 'done' AND due_date < '${cutoff}'`),
        ],
        previewQuery: "SELECT 'tasks' AS table_name, COUNT(*) AS rows_in_table FROM tasks UNION ALL SELECT 'archived_tasks', COUNT(*) FROM archived_tasks",
        skillTags: ["SQL", "CREATE TABLE AS", "DELETE", "Data safety"],
      });
    },
  },
  {
    ...defs.idle,
    areas: [...defs.idle.areas],
    build() {
      return {
        kind: "query", templateId: defs.idle.id, difficulty: "easy", minLevel: "fresher", taskKind: "retrieval",
        title: "Which people have no task assigned?",
        requester: CAST.support,
        scenario: "Hi, I want to message everyone who has nothing assigned so they can pick up unowned work. Some tasks are unassigned (no person at all), and that matters for how you look for people with no tasks.",
        deliverable: "Return user_id and name of every user who is assigned to no task at all, ordered by user_id.",
        referenceQuery: "SELECT u.user_id, u.name FROM users u LEFT JOIN tasks t ON t.assignee_id = u.user_id WHERE t.task_id IS NULL ORDER BY u.user_id",
        mistakeQuery: "SELECT user_id, name FROM users WHERE user_id NOT IN (SELECT assignee_id FROM tasks) ORDER BY user_id",
        skillTags: ["SQL", "LEFT JOIN", "NULL handling", "Anti-join"],
      };
    },
  },
  {
    ...defs.backlog,
    areas: [...defs.backlog.areas],
    build() {
      const open = "SUM(CASE WHEN t.status <> 'done' THEN 1 ELSE 0 END)";
      const done = "SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END)";
      return {
        kind: "query", templateId: defs.backlog.id, difficulty: "medium", minLevel: "fresher", taskKind: "analytics",
        title: "Projects with more open work than finished work",
        requester: CAST.product,
        scenario: "Hello, for the weekly review I want to see only the projects where the backlog is bigger than what has been delivered. A task counts as open when its status is anything except 'done', so both 'todo' and 'in_progress' are open.",
        deliverable: "One row per project, ordered by project_id, for projects where the number of open tasks is greater than the number of done tasks: name, open_tasks and done_tasks.",
        referenceQuery: `SELECT p.name, ${open} AS open_tasks, ${done} AS done_tasks FROM projects p JOIN tasks t ON t.project_id = p.project_id GROUP BY p.project_id, p.name HAVING ${open} > ${done} ORDER BY p.project_id`,
        mistakeQuery: "SELECT p.name, SUM(CASE WHEN t.status = 'todo' THEN 1 ELSE 0 END) AS open_tasks, SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) AS done_tasks FROM projects p JOIN tasks t ON t.project_id = p.project_id GROUP BY p.project_id, p.name HAVING SUM(CASE WHEN t.status = 'todo' THEN 1 ELSE 0 END) > SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) ORDER BY p.project_id",
        skillTags: ["SQL", "GROUP BY", "HAVING", "Conditional aggregation"],
      };
    },
  },
  {
    ...defs.close,
    areas: [...defs.close.areas],
    build(rng) {
      const project = rng.int(1, 8);
      return script(defs.close, {
        title: `Close project ${project} and finish its open tasks`,
        requester: CAST.lead,
        scenario: `Hi, project ${project} was cancelled today. Please close it out in the database: every task of that project that is still open becomes done, with low priority so it drops to the bottom of any list. Tasks that were already done and every other project must stay exactly as they are.`,
        deliverable: `Write an UPDATE that sets status to 'done' and priority to 3 on every task of project ${project} whose status is not 'done'. Nothing else may change.`,
        referenceScript: `UPDATE tasks SET status = 'done', priority = 3 WHERE project_id = ${project} AND status <> 'done';`,
        mistakeScript: `UPDATE tasks SET status = 'done', priority = 3 WHERE project_id = ${project};`,
        probes: [
          probe("The project has no open task left", `SELECT COUNT(*) AS open_tasks FROM tasks WHERE project_id = ${project} AND status <> 'done'`),
          probe("Priorities of the project's tasks", `SELECT priority, COUNT(*) AS tasks FROM tasks WHERE project_id = ${project} GROUP BY priority ORDER BY priority`),
          probe("Other projects are untouched", `SELECT status, priority, COUNT(*) AS tasks FROM tasks WHERE project_id <> ${project} GROUP BY status, priority ORDER BY status, priority`),
        ],
        previewQuery: `SELECT status, priority, COUNT(*) AS tasks FROM tasks WHERE project_id = ${project} GROUP BY status, priority ORDER BY status, priority`,
        skillTags: ["SQL", "UPDATE", "WHERE", "Data safety"],
      });
    },
  },
  {
    ...defs.upsert,
    areas: [...defs.upsert.areas],
    build(rng) {
      const [a, b] = rng.shuffle(PROJECT_NAMES).slice(0, 2);
      const fresh = rng.pick(["Referral programme", "Dark mode", "Invoice reminders"]);
      const [o1, o2, o3] = [rng.int(1, 24), rng.int(1, 24), rng.int(1, 24)];
      return script(defs.upsert, {
        title: "Import the project list from the planning sheet without creating duplicates",
        requester: CAST.product,
        scenario: `Hi, planning sent a sheet with three projects and their new owners: '${fresh}' is brand new, while '${a}' and '${b}' already exist and only need their owner changed. Importing the sheet twice already created a duplicate project once, so please make the database refuse duplicate project names and import the rows so repeating the import is harmless.`,
        deliverable: `Create a unique index on projects (name). Then insert these three projects in one INSERT: (9, ${o1}, '${fresh}', '2026-10-01'), (10, ${o2}, '${a}', '2026-10-01'), (11, ${o3}, '${b}', '2026-10-01'). A project whose name already exists must keep its project_id and created_at and only get the new owner_id (use ON CONFLICT ... DO UPDATE); the new project is inserted as given.`,
        referenceScript: `CREATE UNIQUE INDEX projects_name_unique ON projects (name);\nINSERT INTO projects (project_id, owner_id, name, created_at) VALUES (9, ${o1}, '${fresh}', '2026-10-01'), (10, ${o2}, '${a}', '2026-10-01'), (11, ${o3}, '${b}', '2026-10-01') ON CONFLICT(name) DO UPDATE SET owner_id = excluded.owner_id;`,
        mistakeScript: `INSERT OR IGNORE INTO projects (project_id, owner_id, name, created_at) VALUES (9, ${o1}, '${fresh}', '2026-10-01'), (10, ${o2}, '${a}', '2026-10-01'), (11, ${o3}, '${b}', '2026-10-01');`,
        probes: [
          probe("Projects after the import", "SELECT project_id, owner_id, name, created_at FROM projects ORDER BY project_id"),
          probe("Project names are unique", "SELECT COUNT(*) - COUNT(DISTINCT name) AS duplicate_names FROM projects"),
          probe("The database refuses a duplicate name", "INSERT OR IGNORE INTO projects VALUES (50, 1, (SELECT name FROM projects WHERE project_id = 1), '2026-10-02')", false),
          probe("Still one project per name after the refused insert", "SELECT COUNT(*) AS projects FROM projects"),
        ],
        previewQuery: "SELECT project_id, owner_id, name, created_at FROM projects ORDER BY project_id",
        skillTags: ["SQL", "UNIQUE index", "UPSERT", "ON CONFLICT"],
      });
    },
  },
];
