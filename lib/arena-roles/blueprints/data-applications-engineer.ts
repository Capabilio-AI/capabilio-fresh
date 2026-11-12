import type { RoleBlueprint } from "../blueprint";

/**
 * MCA-03 Database and Data Applications Engineer. Mirrors supabase/migrations/188_data_applications_engineer_role.sql (not applied).
 * 
 * The data side of an application, for an MCA fresher: schema changes, reports and data fixes written as SQL and run by the server on a fresh SQLite copy of
 * the fictional Kaarya app database (lib/workplace/data-applications), plus the small data-layer helpers an application needs around its database, which run
 * in the student's own browser on the shared code workstation.
 */
export const DATA_APPLICATIONS_ENGINEER: RoleBlueprint = {
  roleId: "MCA-03",
  domainRoleKey: "data-applications-engineer",
  name: "Database and Data Applications Engineer",
  competencies: [
    { id: "da.schema", label: "Designing tables: keys, required columns, foreign keys and indexes" },
    { id: "da.constraints", label: "Constraints that stop bad data entering (unique, not null, references)" },
    { id: "da.reports", label: "Report queries: joins, anti-joins, NULL handling and conditional aggregation" },
    { id: "da.safe-change", label: "Changing data safely: targeted UPDATE/DELETE and keeping every row accounted for" },
    { id: "da.upsert", label: "Importing data without duplicates (unique index and upsert)" },
    { id: "da.data-layer", label: "Data-layer logic in code: pagination and merging rows" },
  ],
  unassessed: [
    { id: "da.postgres", label: "PostgreSQL specifics: transactions, locking and EXPLAIN plans" },
    { id: "da.migrations", label: "Versioned schema migrations with a migration tool and rollback" },
    { id: "da.orm", label: "An ORM or data-access library inside a real application" },
    { id: "da.backup", label: "Backup, restore and replication" },
    { id: "da.integration", label: "An application talking to a live database over a connection pool" },
  ],
  areas: [
    { areaKey: "dda-schema-design", toolType: "sql_workspace", generationVersion: "sql.gen.v1", gradingVersion: "sql.grade.v1", executionMode: "executed", status: "enabled", competencies: ["da.schema", "da.constraints"] },
    { areaKey: "dda-reports", toolType: "sql_workspace", generationVersion: "sql.gen.v1", gradingVersion: "sql.grade.v1", executionMode: "executed", status: "enabled", competencies: ["da.reports"] },
    { areaKey: "dda-data-fixes", toolType: "sql_workspace", generationVersion: "sql.gen.v1", gradingVersion: "sql.grade.v1", executionMode: "executed", status: "enabled", competencies: ["da.safe-change", "da.upsert"] },
    { areaKey: "dda-data-layer-logic", toolType: "code_workspace", generationVersion: "code.gen.v1", gradingVersion: "code.grade.v1", executionMode: "client-run", status: "enabled", competencies: ["da.data-layer"] },
  ],
  limitations: [
    "SQL tickets are real SQL run by the server on a fresh SQLite copy of the Kaarya app database, not PostgreSQL, so transactions across requests, locking and EXPLAIN plans are not assessed.",
    "Schema and data-fix tickets are checked by probe queries on the resulting database; the student's script is run once, not reviewed for style or performance.",
    "Data-layer tickets (pagination, merging rows) run the student's function in their own browser; the server compares the outputs it is sent with its own answers and never runs or reads the code, so the explain-your-work interview is the only check that the student understands it.",
    "Each ticket is one script, one query or one function, not a growing application; migration tools, ORMs, backups and a live connection pool are listed as unassessed.",
    "Tickets come only from fixed templates (no AI-written variants), so a student can meet the same ticket again.",
  ],
};
