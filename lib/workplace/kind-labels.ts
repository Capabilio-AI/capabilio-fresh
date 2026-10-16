import type { TaskKind } from "./tickets/types";

/** What each kind of database ticket is called on the board. */
export const TASK_KIND_LABEL: Record<TaskKind, string> = {
  retrieval: "Query the data",
  update: "Update records",
  schema: "Change the schema",
  view: "Build a view",
  index: "Speed it up",
  trigger: "Write a trigger",
  cleanup: "Clean up data",
  migration: "Migrate data",
  function: "Write a function",
  procedure: "Write a procedure",
  constraint: "Protect the data",
  security: "Lock down access",
  upsert: "Merge new data",
  dedupe: "Remove duplicates",
  analytics: "Analyse with SQL",
  debug: "Fix a broken query",
};

export const kindLabel = (kind: string | null | undefined): string | null => (kind && kind in TASK_KIND_LABEL ? TASK_KIND_LABEL[kind as TaskKind] : null);
