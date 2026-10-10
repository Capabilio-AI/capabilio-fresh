import { z } from "zod";
import { completeJson } from "@/lib/ai/groq";
import type { Json } from "@/lib/supabase/types";
import { DatasetSchema, datasetProblems, type Dataset } from "../engines/dataset";
import { STATISTICS_BY_DIFFICULTY, computeExpected, describeQuestion, gradeAnswers, type AnswerField, type ExpectedAnswer, type StatQuestion } from "../engines/stats";
import { GenerationRejected, TIME_LIMIT_MINUTES, type GenerationContext, type GeneratedChallenge, type ToolDefinition } from "../types";
import { HeaderSchema, avoidLine, requesterLine, systemPreamble, withProblems } from "./common";

const QuestionSchema = z.discriminatedUnion("statistic", [
  z.object({ id: z.string(), statistic: z.enum(["mean", "median", "sample_std", "ci95_mean"]), column: z.string() }),
  z.object({ id: z.string(), statistic: z.enum(["pearson_r", "regression"]), x_column: z.string(), y_column: z.string() }),
  z.object({ id: z.string(), statistic: z.literal("two_proportion_test"), group_column: z.string(), outcome_column: z.string() }),
]);

const GenerationSchema = HeaderSchema.extend({
  dataset: DatasetSchema,
  questions: z.array(QuestionSchema).min(1).max(3),
});

export interface StatisticsContent {
  company: string;
  dataset: Dataset;
  questions: { id: string; text: string; fields: AnswerField[] }[];
}
interface StatisticsAnswerKey {
  questions: StatQuestion[];
  expected: ExpectedAnswer[];
}

async function generate(ctx: GenerationContext): Promise<GeneratedChallenge> {
  const allowed = STATISTICS_BY_DIFFICULTY[ctx.difficulty];
  const system = `${systemPreamble(ctx, "statistics / experimentation work")}

Shape:
{
  "company": string, "requester_name": string, "requester_title": string,
  "title": string, "scenario": string, "skill_tags": [string],
  "dataset": { "name": string, "columns": [ { "name": string, "type": "number"|"text"|"date", "description": string } ], "rows": [[...]] },
  "questions": [ { "id": "q1", "statistic": one of ${JSON.stringify(allowed)}, ...parameters } ]
}
Question parameters: mean/median/sample_std/ci95_mean → "column"; pearson_r/regression → "x_column","y_column";
two_proportion_test → "group_column" (exactly two text groups) and "outcome_column" (0/1 conversions).
Dataset: 15-60 rows, realistic measurements for the business (e.g. delivery times, basket sizes, A/B test sessions).
Ask 1-${ctx.difficulty === "easy" ? 2 : 3} questions that genuinely help the stakeholder decide. Numbers only in numeric columns.`;

  const problemsIn = (raw: z.infer<typeof GenerationSchema>): string[] => {
    const problems = datasetProblems(raw.dataset, { minRows: 12, maxRows: 60 });
    raw.questions.forEach((q, i) => {
      if (!allowed.includes(q.statistic)) problems.push(`question ${i + 1}: "${q.statistic}" is not allowed — use one of ${allowed.join(", ")}`);
      else {
        try {
          computeExpected(raw.dataset, { ...q, id: `q${i + 1}` } as StatQuestion);
        } catch (e) {
          problems.push(`question ${i + 1}: ${(e as Error).message}`);
        }
      }
    });
    return problems;
  };

  const raw = await completeJson(`Create the task.${avoidLine(ctx)}`, system, withProblems(GenerationSchema, problemsIn), { task: "arena_task" });
  const problems = problemsIn(raw);
  if (problems.length) throw new GenerationRejected(problems.join("; "));

  const questions = raw.questions.map((q, i) => ({ ...q, id: `q${i + 1}` })) as StatQuestion[];
  const expected: ExpectedAnswer[] = questions.flatMap((q) => computeExpected(raw.dataset, q)); // the server computes every answer

  const content: StatisticsContent = { company: raw.company, dataset: raw.dataset, questions: questions.map((q) => ({ id: q.id, ...describeQuestion(q) })) };
  return {
    title: raw.title,
    category: ctx.areaName,
    requester: requesterLine(raw),
    scenario: raw.scenario,
    objective: content.questions.map((q, i) => `${i + 1}. ${q.text}`).join("\n"),
    skill_tags: raw.skill_tags,
    time_limit_minutes: TIME_LIMIT_MINUTES[ctx.difficulty],
    content: content as unknown as Json,
    answer_key: { questions, expected } as unknown as Json,
  };
}

const SubmissionSchema = z.object({
  answers: z.record(z.string().max(40), z.string().max(40)),
  working: z.string().max(5000).optional(),
});
export type StatisticsSubmission = z.infer<typeof SubmissionSchema>;

export const statisticsTool: ToolDefinition<StatisticsSubmission> = {
  toolType: "statistics_workspace",
  generationVersion: "statistics.gen.v1",
  gradingVersion: "statistics.grade.v1",
  generate,
  submissionSchema: SubmissionSchema,
  async grade(content, answerKey, submission) {
    const c = content as unknown as StatisticsContent;
    const key = answerKey as unknown as StatisticsAnswerKey;
    const results = gradeAnswers(key.expected, submission.answers);
    const labelFor = (k: string) => {
      const [qid] = k.split(".");
      const qi = c.questions.findIndex((q) => q.id === qid);
      const field = c.questions[qi]?.fields.find((f) => f.key === k);
      return `Q${qi + 1} · ${field?.label ?? k}`;
    };
    const checks = results.map((r) => ({ label: labelFor(r.key), passed: r.passed }));
    const passed = checks.every((x) => x.passed);
    return { passed, message: passed ? "Every answer is within the stated precision." : "Some answers are off — check the method and rounding for the failed items.", checks };
  },
};
