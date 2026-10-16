import type { Difficulty } from "@/lib/arena-workstations/types";
import type { Dataset } from "@/lib/arena-workstations/engines/dataset";
import type { ExperienceLevel } from "../level";
import type { Rng } from "../rng";

export interface Requester {
  name: string;
  title: string;
}

/** What kind of database work a ticket asks for, so a sprint can mix them instead of handing out query after query. */
export const TASK_KINDS = ["retrieval", "update", "schema", "view", "index", "trigger", "cleanup", "migration", "function", "procedure", "constraint", "security", "upsert", "dedupe", "analytics", "debug"] as const;
export type TaskKind = (typeof TASK_KINDS)[number];

/** One hidden check on the database after the user's script ran. A probe that does not `compare` only changes data (to fire a trigger). */
export interface Probe {
  /** shown to the user as the name of the check, never the SQL */
  label: string;
  sql: string;
  compare: boolean;
}

interface Base {
  templateId: string;
  difficulty: Difficulty;
  /** the least experienced level this ticket suits */
  minLevel: ExperienceLevel;
  taskKind: TaskKind;
  title: string;
  requester: Requester;
  /** the stakeholder's message in their own voice */
  scenario: string;
  /** exactly what to deliver */
  deliverable: string;
  skillTags: string[];
}

export interface QueryDraft extends Base {
  kind: "query";
  referenceQuery: string;
  /** the classic wrong answer; it must give a different result from the reference */
  mistakeQuery: string;
  /** a debugging ticket: the broken query the user starts from (it may run and give wrong numbers, or fail outright) */
  starterQuery?: string;
  /** when the ticket is a "top N", the ranking must have no tie at the cut-off */
  tieGuard?: { query: string; n: number; metricColumn: number };
}

/** The user writes a script (UPDATE, ALTER, CREATE INDEX / VIEW / TRIGGER ...); it is graded on the database it leaves behind. */
export interface ScriptDraft extends Base {
  kind: "script";
  referenceScript: string;
  mistakeScript: string;
  probes: Probe[];
  /** tables the script needs that the warehouse does not have (for example an empty audit table) */
  extraTables?: Dataset[];
  /** SQL run after the warehouse and extra tables exist: derived tables, roles, constraints the task builds on */
  extraSetupSql?: string;
  /** a read-only query the workspace runs after the user's script so they can see the effect */
  previewQuery: string;
}

export type TicketDraft = QueryDraft | ScriptDraft;

export interface TicketTemplate {
  id: string;
  difficulty: Difficulty;
  minLevel: ExperienceLevel;
  taskKind: TaskKind;
  /** the skill areas this ticket belongs to; a template without it belongs to "sql" */
  areas?: string[];
  build(rng: Rng): TicketDraft;
}
