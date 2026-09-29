import { z } from "zod";
import { completeJson } from "@/lib/ai/groq";
import type { Json } from "@/lib/supabase/types";
import { DatasetSchema, datasetProblems } from "../engines/dataset";
import { SheetTaskSchema, buildLayout, computeExpectedCells, gradeSpreadsheet, type SheetLayout, type SpreadsheetContent } from "../engines/spreadsheet";
import { GenerationRejected, TIME_LIMIT_MINUTES, type GenerationContext, type GeneratedChallenge, type ToolDefinition } from "../types";
import { HeaderSchema, avoidLine, requesterLine, systemPreamble, withProblems } from "./common";

const GenerationSchema = HeaderSchema.extend({
  data: DatasetSchema,
  lookup: DatasetSchema.nullable(),
  tasks: z.array(SheetTaskSchema).min(1).max(4),
});

export interface SpreadsheetPublicContent extends SpreadsheetContent {
  company: string;
  layout: SheetLayout;
}

const baseContent = (raw: z.infer<typeof GenerationSchema>): SpreadsheetContent => ({ data: raw.data, lookup: raw.tasks.some((t) => t.type === "lookup") ? raw.lookup : null, tasks: raw.tasks });

function problemsIn(raw: z.infer<typeof GenerationSchema>): string[] {
  const problems = [...datasetProblems(raw.data, { minRows: 6, maxRows: 30 }), ...(raw.lookup ? datasetProblems(raw.lookup, { minRows: 2, maxRows: 20 }) : [])];
  if (problems.length) return problems;
  const columns = new Set(raw.data.columns.map((c) => c.name));
  raw.tasks.forEach((t, i) => {
    const used = t.type === "row_formula" ? [t.left, t.right] : t.type === "lookup" ? [t.key_column] : t.type === "summary" ? [t.column] : [t.criteria_column, t.column];
    for (const c of used) if (!columns.has(c)) problems.push(`task ${i + 1}: "${c}" must be one of the original data columns (${[...columns].join(", ")})`);
  });
  if (raw.tasks.some((t) => t.type === "lookup") && (!raw.lookup || raw.lookup.columns.length !== 2)) problems.push("a lookup task needs a two-column lookup table");
  if (problems.length) return problems;
  try {
    const base = baseContent(raw);
    computeExpectedCells(base, buildLayout(base));
  } catch (e) {
    problems.push((e as Error).message);
  }
  return problems;
}

async function generate(ctx: GenerationContext): Promise<GeneratedChallenge> {
  const system = `${systemPreamble(ctx, "Excel workbook")}

Shape:
{
  "company": string, "requester_name": string, "requester_title": string,
  "title": string, "scenario": string, "skill_tags": [string],
  "data": { "name": string, "columns": [ { "name": string, "type": "number"|"text"|"date", "description": string } ], "rows": [[...]] },
  "lookup": null or { "name": string, "columns": [ {"name": key column, "type": "text"}, {"name": value column, "type": "number"} ], "rows": [[key, value]...] },
  "tasks": [ ${ctx.difficulty === "easy" ? "1-2" : ctx.difficulty === "medium" ? "2-3" : "3-4"} tasks ]
}
Task types (exact JSON):
{"type":"row_formula","header","op":"multiply"|"divide"|"add"|"subtract"|"percent_change"|"percent_of","left":column,"right":column,"decimals":0-2}
{"type":"lookup","header","key_column"}   (needs "lookup"; every key in key_column must exist in the lookup table)
{"type":"summary","label","fn":"SUM"|"AVERAGE"|"MAX"|"MIN"|"COUNT","column","decimals":0-2}
{"type":"conditional_summary","label","fn":"SUMIF"|"COUNTIF"|"AVERAGEIF","criteria_column","criteria_value","column","decimals":0-2}
The data is a clean business table (8-25 rows, numbers as JSON numbers, no zero denominators). Tasks must be what the
stakeholder actually needs (e.g. line revenue, margin %, regional totals, tax rate lookup).`;

  const raw = await completeJson(`Create the task.${avoidLine(ctx)}`, system, withProblems(GenerationSchema, problemsIn));
  const problems = problemsIn(raw);
  if (problems.length) throw new GenerationRejected(problems.join("; "));

  const base = baseContent(raw);
  const layout: SheetLayout = buildLayout(base);
  const expected = computeExpectedCells(base, layout); // server computes every target value from the data

  const content: SpreadsheetPublicContent = { ...base, company: raw.company, layout };
  return {
    title: raw.title,
    category: ctx.areaName,
    requester: requesterLine(raw),
    scenario: raw.scenario,
    objective: layout.targets.map((t, i) => `${i + 1}. ${t.instruction}`).join("\n"),
    skill_tags: raw.skill_tags,
    time_limit_minutes: TIME_LIMIT_MINUTES[ctx.difficulty],
    content: content as unknown as Json,
    answer_key: { expected } as unknown as Json,
  };
}

const SubmissionSchema = z.object({ cells: z.record(z.string().max(8), z.string().max(500)) });
export type SpreadsheetSubmission = z.infer<typeof SubmissionSchema>;

export const spreadsheetTool: ToolDefinition<SpreadsheetSubmission> = {
  toolType: "spreadsheet_workspace",
  generationVersion: "spreadsheet.gen.v1",
  gradingVersion: "spreadsheet.grade.v1",
  generate,
  submissionSchema: SubmissionSchema,
  async grade(content, answerKey, submission) {
    const c = content as unknown as SpreadsheetPublicContent;
    const key = answerKey as unknown as { expected: Record<string, number> };
    return gradeSpreadsheet({ data: c.data, lookup: c.lookup, tasks: c.tasks }, key.expected, submission.cells);
  },
};
