import { z } from "zod";
import { completeJson } from "@/lib/ai/groq";
import type { Json } from "@/lib/supabase/types";
import { DatasetSchema, datasetProblems, type Dataset } from "../engines/dataset";
import { CleaningStepSchema, applySteps, compareCleanTables, describeStep, noOpSteps, type CleaningStep } from "../engines/cleaning";
import { GenerationRejected, TIME_LIMIT_MINUTES, type GenerationContext, type GeneratedChallenge, type ToolDefinition } from "../types";
import { HeaderSchema, avoidLine, requesterLine, systemPreamble, withProblems } from "./common";

const GenerationSchema = HeaderSchema.extend({
  dataset: DatasetSchema,
  steps: z.array(CleaningStepSchema).min(3).max(7),
});

export interface CleaningContent {
  company: string;
  dataset: Dataset;
  requirements: string[];
}
interface CleaningAnswerKey {
  steps: CleaningStep[];
  expected_rows: number;
}

function problemsIn(raw: z.infer<typeof GenerationSchema>): string[] {
  const problems = datasetProblems(raw.dataset, { minRows: 10, maxRows: 40, messy: true });
  if (problems.length) return problems;
  try {
    const noOps = noOpSteps(raw.dataset, raw.steps);
    if (noOps.length) problems.push(`steps ${noOps.map((i) => i + 1).join(", ")} change nothing in the data — every step must fix something real`);
    if (applySteps(raw.dataset, raw.steps).rows.length < 5) problems.push("the cleaned table must keep at least 5 rows");
  } catch (e) {
    problems.push((e as Error).message);
  }
  return problems;
}

async function generate(ctx: GenerationContext): Promise<GeneratedChallenge> {
  const stepCount = ctx.difficulty === "easy" ? "3-4" : ctx.difficulty === "medium" ? "4-5" : "5-7";
  const system = `${systemPreamble(ctx, "data preparation work (a Power Query-style cleaning tool)")}

Shape:
{
  "company": string, "requester_name": string, "requester_title": string,
  "title": string, "scenario": string, "skill_tags": [string],
  "dataset": { "name": string, "columns": [ { "name": string, "type": "number"|"text"|"date", "description": string } ], "rows": [[...]] },
  "steps": [ ...${stepCount} cleaning steps that turn the raw export into a usable table ]
}
The dataset is a RAW, messy export (15-35 rows): declared "type" is what the column SHOULD be after cleaning, but raw
values may be strings like " Mumbai", "mumbai ", "₹1,250", "12/08/2026", empty strings, nulls, duplicate records.
Allowed steps (exact JSON):
{"op":"trim","column"} {"op":"lowercase","column"} {"op":"titlecase","column"}
{"op":"replace","column","from","to"}  (standardise a category spelling, exact whole-value match)
{"op":"to_number","column"}  {"op":"to_date","column","format":"DD/MM/YYYY"|"MM/DD/YYYY"|"DD-MM-YYYY"|"YYYY/MM/DD"|"YYYY-MM-DD"}
{"op":"drop_missing","column"}  {"op":"dedupe","columns":[...]}  {"op":"filter","column","operator":">"|">="|"<"|"<="|"="|"!=","value"}
Every step must actually change the data, and the mess must be realistic (typos a CRM or form export really produces).`;

  const raw = await completeJson(`Create the task.${avoidLine(ctx)}`, system, withProblems(GenerationSchema, problemsIn));
  const problems = problemsIn(raw);
  if (problems.length) throw new GenerationRejected(problems.join("; "));
  const expectedRows = applySteps(raw.dataset, raw.steps).rows.length; // server applies the steps — the key is computed, not asserted

  const content: CleaningContent = { company: raw.company, dataset: raw.dataset, requirements: raw.steps.map(describeStep) };
  return {
    title: raw.title,
    category: ctx.areaName,
    requester: requesterLine(raw),
    scenario: raw.scenario,
    objective: content.requirements.map((r, i) => `${i + 1}. ${r}`).join("\n"),
    skill_tags: raw.skill_tags,
    time_limit_minutes: TIME_LIMIT_MINUTES[ctx.difficulty],
    content: content as unknown as Json,
    answer_key: { steps: raw.steps, expected_rows: expectedRows } as unknown as Json,
  };
}

const SubmissionSchema = z.object({ steps: z.array(CleaningStepSchema).max(25) });
export type CleaningSubmission = z.infer<typeof SubmissionSchema>;

export const cleaningTool: ToolDefinition<CleaningSubmission> = {
  toolType: "cleaning_workspace",
  generationVersion: "cleaning.gen.v1",
  gradingVersion: "cleaning.grade.v1",
  generate,
  submissionSchema: SubmissionSchema,
  async grade(content, answerKey, submission) {
    const c = content as unknown as CleaningContent;
    const key = answerKey as unknown as CleaningAnswerKey;
    const expected = applySteps(c.dataset, key.steps);
    let actualRows: number;
    let result;
    try {
      const actual = applySteps(c.dataset, submission.steps);
      actualRows = actual.rows.length;
      result = compareCleanTables(expected, actual);
    } catch (e) {
      return { passed: false, message: `Your steps can't be applied: ${(e as Error).message}.`, checks: [] };
    }
    return {
      passed: result.passed,
      message: result.message,
      checks: [
        { label: `Row count (${expected.rows.length} expected)`, passed: actualRows === expected.rows.length },
        { label: "Every cleaned value matches", passed: result.missingRows === 0 && result.extraRows === 0 },
      ],
    };
  },
};
