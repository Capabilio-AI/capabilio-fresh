import { z } from "zod";
import { completeJson } from "@/lib/ai/groq";
import type { Json } from "@/lib/supabase/types";
import { DatasetSchema, datasetProblems, type Dataset } from "../engines/dataset";
import { buildSeedSql } from "../engines/seed-sql";
import { engineOf } from "@/lib/workplace/sql/engine";
import { seedParts, seedText } from "@/lib/workplace/tickets/pick";
import { runSqlQueries, type SqlResult } from "../engines/sql-runner";
import type { Probe } from "@/lib/workplace/tickets/types";
import { gradeSqlResult } from "../engines/sql-grade";
import { GenerationRejected, TIME_LIMIT_MINUTES, type GenerationContext, type GeneratedChallenge, type GradeResult, type ToolDefinition } from "../types";
import { hashSeed, makeRng } from "@/lib/workplace/rng";
import { worldForRole } from "@/lib/workplace/worlds";
import { pickTicket } from "@/lib/workplace/tickets/pick";
import type { TaskKind } from "@/lib/workplace/tickets/types";
import { HeaderSchema, avoidLine, requesterLine, systemPreamble, withProblems } from "./common";

export { buildSeedSql };

/** The database a task runs on, rebuilt from its stored content exactly as it was when the ticket was validated. */
const seedOf = (c: SqlContent): string => seedText({ tables: c.tables, setupSql: c.setupSql ?? "" }, engineOf(c.engine).key);

export interface SqlContent {
  company: string;
  tables: Dataset[];
  deliverable: string;
  /** "script": the user writes a whole SQL script (UPDATE, ALTER, CREATE INDEX ...) graded on the database it leaves behind */
  mode?: "query" | "script";
  /** which database runs the task; absent means SQLite */
  engine?: "sqlite" | "postgres";
  /** SQL run after the tables are built: constraints, roles, derived tables */
  setupSql?: string;
  taskKind?: string;
  /** a debugging task: the broken query the editor opens with */
  starter?: string;
  /** script tasks: a read-only query run after the user's script so they can see its effect */
  previewQuery?: string;
}
interface QueryAnswerKey {
  reference_query: string;
  /** a second, independently written query (AI-made tasks only) */
  independent_query?: string;
  expected: SqlResult;
}
interface ScriptAnswerKey {
  kind: "script";
  reference_script: string;
  probes: Probe[];
  /** the results of the graded probes after the reference script, in probe order */
  expected_probes: SqlResult[];
}
type SqlAnswerKey = QueryAnswerKey | ScriptAnswerKey;
const isScriptKey = (k: SqlAnswerKey): k is ScriptAnswerKey => (k as ScriptAnswerKey).kind === "script";

const GenerationSchema = HeaderSchema.extend({
  tables: z.array(DatasetSchema).min(1).max(3),
  deliverable: z.string().min(30).max(600),
  reference_query: z.string().min(10).max(3000),
});

const READ_ONLY = /^\s*(with|select)\b/i;

function isSingleReadOnlyStatement(q: string): boolean {
  const body = q.trim().replace(/;\s*$/, "");
  return READ_ONLY.test(body) && !body.includes(";");
}

function problemsIn(raw: z.infer<typeof GenerationSchema>): string[] {
  const names = raw.tables.map((t) => t.name);
  const problems = raw.tables.flatMap((t) => datasetProblems(t, { minRows: 5, maxRows: 60 }));
  if (new Set(names).size !== names.length) problems.push("table names must be unique");
  if (!isSingleReadOnlyStatement(raw.reference_query)) problems.push("reference_query must be exactly one SELECT (or WITH … SELECT) statement");
  return problems;
}

function schemaText(tables: Dataset[]): string {
  return tables.map((t) => `${t.name}(${t.columns.map((c) => `${c.name} ${c.type}${c.description ? ` -- ${c.description}` : ""}`).join(", ")})`).join("\n");
}

async function generateWithAi(ctx: GenerationContext): Promise<GeneratedChallenge> {
  const system = `${systemPreamble(ctx, "SQL analytics warehouse (SQLite dialect)")}

Shape:
{
  "company": string, "requester_name": string, "requester_title": string,
  "title": string (the ticket title), "scenario": string, "skill_tags": [string],
  "tables": [ { "name": string, "columns": [ { "name": string, "type": "number"|"text"|"date", "description": string } ],
               "rows": [[values...]] } ],   // ${ctx.difficulty === "easy" ? "1-2 tables" : "2-3 tables that must be joined"}, 10-45 rows each; dates as "YYYY-MM-DD"; numbers as JSON numbers
  "deliverable": string,   // exactly which columns the result must have, filters, grouping, ordering and rounding
  "reference_query": string // ONE SQLite SELECT (or WITH ... SELECT) that produces exactly the deliverable
}
The result must contain at least one computed number (count, sum, average, rate…), have 1–20 rows, and be fully
specified by "deliverable" (column meaning, rounding, sort order) so a competent analyst gets the same numbers.`;

  const raw = await completeJson(`Create the task.${avoidLine(ctx)}`, system, withProblems(GenerationSchema, problemsIn), { task: "arena_task" });
  const problems = problemsIn(raw);
  if (problems.length) throw new GenerationRejected(problems.join("; "));

  // Independent check: a second model call writes its own query from the
  // candidate-visible brief alone; both must produce the same result.
  const independent = await completeJson(
    `Schema (SQLite):\n${schemaText(raw.tables)}\n\nRequest:\n${raw.deliverable}`,
    `You are a careful senior data analyst. Write ONE SQLite SELECT query that produces exactly what the request asks for. Respond with JSON only: {"query": string}.`,
    z.object({ query: z.string().min(10).max(3000) }),
    { task: "arena_task" }
  );
  if (!isSingleReadOnlyStatement(independent.query)) throw new GenerationRejected("independent query was not a single SELECT");

  const seed = buildSeedSql(raw.tables);
  const [expected, check] = await runSqlQueries(seed, [raw.reference_query, independent.query]);
  if ("error" in expected) throw new GenerationRejected(`reference query failed: ${expected.error}`);
  if (expected.rows.length < 1 || expected.rows.length > 20) throw new GenerationRejected("result must have 1-20 rows");
  if (!expected.rows.flat().some((v) => typeof v === "number")) throw new GenerationRejected("result has no computed number");
  if (!gradeSqlResult(expected, check).passed) throw new GenerationRejected("independent query disagreed with the reference");

  const content: SqlContent = { company: raw.company, tables: raw.tables, deliverable: raw.deliverable };
  const answerKey: QueryAnswerKey = { reference_query: raw.reference_query, independent_query: independent.query, expected };
  return {
    title: raw.title,
    category: ctx.areaName,
    requester: requesterLine(raw),
    scenario: raw.scenario,
    objective: raw.deliverable,
    skill_tags: raw.skill_tags,
    time_limit_minutes: TIME_LIMIT_MINUTES[ctx.difficulty],
    content: content as unknown as Json,
    answer_key: answerKey as unknown as Json,
  };
}

/** A ticket from the role's company world: the user's own warehouse, a parameterised template, an answer computed by running the reference. */
async function generateFromWorld(ctx: GenerationContext, world: NonNullable<ReturnType<typeof worldForRole>>): Promise<GeneratedChallenge> {
  const tables = world.generate(ctx.worldSeed!);
  const engine = engineOf(world.engine);
  const picked = await pickTicket({
    templates: ctx.onlyTaskKinds ? world.templates.filter((t) => ctx.onlyTaskKinds!.includes(t.taskKind)) : world.templates, difficulty: ctx.difficulty, level: ctx.level ?? "fresher", rng: makeRng(ctx.ticketSeed ?? hashSeed("ticket")),
    avoidTitles: ctx.avoidTitles, recentKinds: (ctx.recentKinds ?? []) as TaskKind[], tables,
    runners: engine.runners, dialect: engine.key, setupSql: world.setupSql, areaKey: ctx.areaKey,
  });
  if (!picked) throw new GenerationRejected("no valid ticket could be built for this user");
  const { draft, expected } = picked;

  const base = {
    title: draft.title,
    category: ctx.areaName,
    requester: `${draft.requester.name} · ${draft.requester.title}`,
    scenario: draft.scenario,
    objective: draft.deliverable,
    skill_tags: draft.skillTags,
    time_limit_minutes: TIME_LIMIT_MINUTES[ctx.difficulty],
    origin: { provider: "template", model: `${world.key}.sql.v3` },
  };
  if (draft.kind === "query") {
    const content: SqlContent = { company: world.name, tables, deliverable: draft.deliverable, mode: "query", taskKind: draft.taskKind, starter: draft.starterQuery, engine: engine.key, setupSql: world.setupSql };
    const answerKey: QueryAnswerKey = { reference_query: draft.referenceQuery, expected: expected[0] };
    return { ...base, content: content as unknown as Json, answer_key: answerKey as unknown as Json };
  }
  const parts = seedParts(tables, draft, world.setupSql);
  const content: SqlContent = { company: world.name, tables: parts.tables, deliverable: draft.deliverable, mode: "script", taskKind: draft.taskKind, previewQuery: draft.previewQuery, engine: engine.key, setupSql: parts.setupSql };
  const answerKey: ScriptAnswerKey = { kind: "script", reference_script: draft.referenceScript, probes: draft.probes, expected_probes: expected };
  return { ...base, content: content as unknown as Json, answer_key: answerKey as unknown as Json };
}

async function generate(ctx: GenerationContext): Promise<GeneratedChallenge> {
  const world = worldForRole(ctx.roleKey);
  return world && ctx.worldSeed !== undefined ? generateFromWorld(ctx, world) : generateWithAi(ctx);
}

const SubmissionSchema = z.object({ query: z.string().trim().min(1).max(5000), note: z.string().max(2000).optional() });
export type SqlSubmission = z.infer<typeof SubmissionSchema>;

export const sqlTool: ToolDefinition<SqlSubmission> = {
  toolType: "sql_workspace",
  generationVersion: "sql.gen.v1",
  gradingVersion: "sql.grade.v1",
  generate,
  submissionSchema: SubmissionSchema,
  async grade(content, answerKey, submission) {
    const c = content as unknown as SqlContent;
    const key = answerKey as unknown as SqlAnswerKey;
    if (isScriptKey(key)) return gradeScript(c, key, submission.query);
    const [expected, actual] = await engineOf(c.engine).runners.query(seedOf(c), [key.reference_query, submission.query]);
    const feedback = gradeSqlResult(expected, actual);
    return {
      passed: feedback.passed,
      message: feedback.message,
      checks: [
        { label: "Query runs", passed: !("error" in actual) },
        { label: `Row count (${feedback.expectedRows} expected)`, passed: feedback.actualRows === feedback.expectedRows },
        { label: "All expected values present", passed: feedback.matchedValues === feedback.totalValues },
      ],
      detail: actual as unknown as Json,
    };
  },
};

/** Script tasks: run the user's script on a fresh copy of the warehouse, then compare what the hidden probes see with the reference. */
async function gradeScript(c: SqlContent, key: ScriptAnswerKey, script: string): Promise<GradeResult> {
  const run = await engineOf(c.engine).runners.script(seedOf(c), script, key.probes.map((p) => p.sql));
  if (run.scriptError) {
    return { passed: false, message: `Your script failed: ${run.scriptError}`, checks: [{ label: "Script runs", passed: false }, ...key.probes.filter((p) => p.compare).map((p) => ({ label: p.label, passed: false }))] };
  }
  const graded = key.probes.flatMap((p, i) => (p.compare ? [{ label: p.label, passed: gradeSqlResult(expectedOf(key, p), run.probes[i]).passed }] : []));
  const passed = graded.every((g) => g.passed);
  return {
    passed,
    message: passed ? "The database ended up exactly as it should." : `${graded.filter((g) => !g.passed).length} of ${graded.length} checks failed. Look at the data your script left behind.`,
    checks: [{ label: "Script runs", passed: true }, ...graded],
  };
}

/** The reference result for one graded probe: expected_probes holds only the graded ones, in order. */
function expectedOf(key: ScriptAnswerKey, probe: Probe): SqlResult {
  const index = key.probes.filter((p) => p.compare).indexOf(probe);
  return key.expected_probes[index];
}

/** Exploration: runs the candidate's SQL against their instance's data only. For a script task it runs the script then shows the preview query, unless `explore` asks to just look at the original data. */
export async function runExploratoryQuery(content: Json, query: string, explore = false): Promise<SqlResult> {
  const c = content as unknown as SqlContent;
  if (c.mode === "script" && c.previewQuery && !explore) {
    const run = await engineOf(c.engine).runners.script(seedOf(c), query, [c.previewQuery]);
    return run.scriptError ? { error: run.scriptError } : run.probes[0];
  }
  const [result] = await engineOf(c.engine).runners.query(seedOf(c), [query]);
  return result;
}
