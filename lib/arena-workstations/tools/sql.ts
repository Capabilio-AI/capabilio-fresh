import { z } from "zod";
import { completeJson } from "@/lib/ai/groq";
import type { Json } from "@/lib/supabase/types";
import { DatasetSchema, datasetProblems, type Dataset } from "../engines/dataset";
import { runSqlQueries, type SqlResult } from "../engines/sql-runner";
import { gradeSqlResult } from "../engines/sql-grade";
import { GenerationRejected, TIME_LIMIT_MINUTES, type GenerationContext, type GeneratedChallenge, type ToolDefinition } from "../types";
import { HeaderSchema, avoidLine, requesterLine, systemPreamble, withProblems } from "./common";

export interface SqlContent {
  company: string;
  tables: Dataset[];
  deliverable: string;
}
interface SqlAnswerKey {
  reference_query: string;
  independent_query: string;
  expected: SqlResult;
}

const GenerationSchema = HeaderSchema.extend({
  tables: z.array(DatasetSchema).min(1).max(3),
  deliverable: z.string().min(30).max(600),
  reference_query: z.string().min(10).max(3000),
});

const READ_ONLY = /^\s*(with|select)\b/i;

/** Pure. Builds the seed script from validated structured data — the AI never supplies DDL. */
export function buildSeedSql(tables: Dataset[]): string {
  const lines: string[] = [];
  for (const t of tables) {
    const cols = t.columns.map((c, j) => {
      const values = t.rows.map((r) => r[j]).filter((v) => v !== null);
      const type = c.type === "number" ? (values.every((v) => Number.isInteger(v)) ? "INTEGER" : "REAL") : "TEXT";
      return `"${c.name}" ${type}`;
    });
    lines.push(`CREATE TABLE "${t.name}" (${cols.join(", ")});`);
    for (const row of t.rows) {
      const vals = row.map((v) => (v === null ? "NULL" : typeof v === "number" ? String(v) : `'${v.replace(/'/g, "''")}'`));
      lines.push(`INSERT INTO "${t.name}" VALUES (${vals.join(", ")});`);
    }
  }
  return lines.join("\n");
}

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

async function generate(ctx: GenerationContext): Promise<GeneratedChallenge> {
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

  const raw = await completeJson(`Create the task.${avoidLine(ctx)}`, system, withProblems(GenerationSchema, problemsIn));
  const problems = problemsIn(raw);
  if (problems.length) throw new GenerationRejected(problems.join("; "));

  // Independent check: a second model call writes its own query from the
  // candidate-visible brief alone; both must produce the same result.
  const independent = await completeJson(
    `Schema (SQLite):\n${schemaText(raw.tables)}\n\nRequest:\n${raw.deliverable}`,
    `You are a careful senior data analyst. Write ONE SQLite SELECT query that produces exactly what the request asks for. Respond with JSON only: {"query": string}.`,
    z.object({ query: z.string().min(10).max(3000) })
  );
  if (!isSingleReadOnlyStatement(independent.query)) throw new GenerationRejected("independent query was not a single SELECT");

  const seed = buildSeedSql(raw.tables);
  const [expected, check] = await runSqlQueries(seed, [raw.reference_query, independent.query]);
  if ("error" in expected) throw new GenerationRejected(`reference query failed: ${expected.error}`);
  if (expected.rows.length < 1 || expected.rows.length > 20) throw new GenerationRejected("result must have 1-20 rows");
  if (!expected.rows.flat().some((v) => typeof v === "number")) throw new GenerationRejected("result has no computed number");
  if (!gradeSqlResult(expected, check).passed) throw new GenerationRejected("independent query disagreed with the reference");

  const content: SqlContent = { company: raw.company, tables: raw.tables, deliverable: raw.deliverable };
  const answerKey: SqlAnswerKey = { reference_query: raw.reference_query, independent_query: independent.query, expected };
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
    const [expected, actual] = await runSqlQueries(buildSeedSql(c.tables), [key.reference_query, submission.query]);
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

/** Exploration: runs the candidate's query against their instance's data only. */
export async function runExploratoryQuery(content: Json, query: string): Promise<SqlResult> {
  const [result] = await runSqlQueries(buildSeedSql((content as unknown as SqlContent).tables), [query]);
  return result;
}
