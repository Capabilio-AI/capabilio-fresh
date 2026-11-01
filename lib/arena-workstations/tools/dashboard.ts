import { z } from "zod";
import { completeJson } from "@/lib/ai/groq";
import type { Json } from "@/lib/supabase/types";
import { DatasetSchema, datasetProblems, type Dataset } from "../engines/dataset";
import { BiSpecSchema, describeSpec, evaluateSpec, gradeDashboard, suitableChartTypes, type BiSpec } from "../engines/bi";
import { GenerationRejected, TIME_LIMIT_MINUTES, type GenerationContext, type GeneratedChallenge, type ToolDefinition } from "../types";
import { hashSeed, makeRng } from "@/lib/workplace/rng";
import { checkDashboard, pickOffice } from "@/lib/workplace/office/pick";
import { worldForRole, type World } from "@/lib/workplace/worlds";
import { levelAtLeast } from "@/lib/workplace/level";
import { gradeNote, type NoteKey } from "@/lib/workplace/findings-note";
import { HeaderSchema, avoidLine, requesterLine, systemPreamble, withProblems } from "./common";

const GenerationSchema = HeaderSchema.extend({ dataset: DatasetSchema, spec: BiSpecSchema });

export interface DashboardContent {
  company: string;
  dataset: Dataset;
  requirements: string[];
  /** from junior level up the chart comes with a takeaway for the reader, and it is graded */
  noteRequired?: boolean;
}

/** The takeaway of a chart is its standout: the group with the highest value and that value. */
function takeawayKey(dataset: Dataset, spec: BiSpec): NoteKey {
  const top = [...evaluateSpec(dataset, spec)].sort((a, b) => b.value - a.value)[0];
  return top ? { figures: [{ value: top.value, tolerance: top.value < 1000 ? 0.5 : 1 }], names: [top.label] } : { figures: [], names: [] };
}

function problemsIn(raw: z.infer<typeof GenerationSchema>): string[] {
  const problems = datasetProblems(raw.dataset, { minRows: 20, maxRows: 90 });
  if (problems.length) return problems;
  try {
    const points = evaluateSpec(raw.dataset, raw.spec).length; // server evaluates; key = the evaluated series
    if (points < 2 || points > 20) problems.push(`the chart would have ${points} points — it needs 2-20`);
    else {
      const suitable = suitableChartTypes(raw.dataset, raw.spec, points);
      if (!suitable.includes(raw.spec.chart_type)) problems.push(`chart_type "${raw.spec.chart_type}" doesn't suit this data — use one of ${suitable.join(", ")}`);
    }
  } catch (e) {
    problems.push((e as Error).message);
  }
  return problems;
}

async function generateWithAi(ctx: GenerationContext): Promise<GeneratedChallenge> {
  const system = `${systemPreamble(ctx, "BI / dashboarding tool")}

Shape:
{
  "company": string, "requester_name": string, "requester_title": string,
  "title": string, "scenario": string, "skill_tags": [string],
  "dataset": { "name": string, "columns": [ { "name": string, "type": "number"|"text"|"date", "description": string } ], "rows": [[...]] },
  "spec": {
    "chart_type": "bar"|"line"|"pie"|"table", "dimension": column, "dimension_grain": "value"|"month",
    "measure": numeric column or null (only for count), "aggregation": "sum"|"avg"|"count"|"min"|"max",
    "filters": [ { "column", "operator": "="|"!="|">"|">="|"<"|"<=", "value" } ]  (${ctx.difficulty === "easy" ? "0-1" : "1-2"}),
    "sort": "dimension_asc"|"measure_desc"|"measure_asc", "limit": null or 3-10
  }
}
The dataset is clean (30-80 rows, dates "YYYY-MM-DD", real numbers) and the spec is the ONE chart that answers the
stakeholder's question. Use "month" grain only with a date dimension; a time trend should be a line chart.`;

  const raw = await completeJson(`Create the task.${avoidLine(ctx)}`, system, withProblems(GenerationSchema, problemsIn), { task: "arena_task" });
  const problems = problemsIn(raw);
  if (problems.length) throw new GenerationRejected(problems.join("; "));

  const content: DashboardContent = { company: raw.company, dataset: raw.dataset, requirements: describeSpec(raw.spec) };
  return {
    title: raw.title,
    category: ctx.areaName,
    requester: requesterLine(raw),
    scenario: raw.scenario,
    objective: content.requirements.join(" "),
    skill_tags: raw.skill_tags,
    time_limit_minutes: TIME_LIMIT_MINUTES[ctx.difficulty],
    content: content as unknown as Json,
    answer_key: { spec: raw.spec } as unknown as Json,
  };
}

/** A ticket on a reporting table built from the company's own data; the chart that answers it is fixed by the template (no AI involved). */
function generateFromWorld(ctx: GenerationContext, world: World): GeneratedChallenge {
  const picked = pickOffice(
    { templates: world.office!.dashboards, areaKey: ctx.areaKey ?? "dashboard", difficulty: ctx.difficulty, level: ctx.level ?? "fresher", rng: makeRng(ctx.ticketSeed ?? hashSeed("dashboard")), avoidTitles: ctx.avoidTitles, tables: world.generate(ctx.worldSeed!) },
    checkDashboard
  );
  if (!picked) throw new GenerationRejected("no valid dashboard ticket could be built for this user");
  const { draft } = picked;
  const noteRequired = levelAtLeast(ctx.level ?? "fresher", "junior");
  const content: DashboardContent = { company: world.name, dataset: draft.dataset, requirements: [...describeSpec(draft.spec), ...(noteRequired ? ["Add a takeaway for the reader: which one stands out, its value, and what you would do about it."] : [])], noteRequired };
  return {
    title: draft.title,
    category: ctx.areaName,
    requester: `${draft.requester.name} · ${draft.requester.title}`,
    scenario: draft.scenario,
    objective: content.requirements.join(" "),
    skill_tags: draft.skillTags,
    time_limit_minutes: TIME_LIMIT_MINUTES[ctx.difficulty],
    content: content as unknown as Json,
    answer_key: { spec: draft.spec, note: noteRequired ? takeawayKey(draft.dataset, draft.spec) : undefined } as unknown as Json,
    origin: { provider: "template", model: `${world.key}.dashboard.v1` },
  };
}

async function generate(ctx: GenerationContext): Promise<GeneratedChallenge> {
  const world = worldForRole(ctx.roleKey);
  return world?.office && ctx.worldSeed !== undefined ? generateFromWorld(ctx, world) : generateWithAi(ctx);
}

const SubmissionSchema = z.object({ spec: BiSpecSchema, note: z.string().max(2000).optional() });
export type DashboardSubmission = z.infer<typeof SubmissionSchema>;

export const dashboardTool: ToolDefinition<DashboardSubmission> = {
  toolType: "dashboard_workspace",
  generationVersion: "dashboard.gen.v1",
  gradingVersion: "dashboard.grade.v1",
  generate,
  submissionSchema: SubmissionSchema,
  async grade(content, answerKey, submission) {
    const c = content as unknown as DashboardContent;
    const key = answerKey as unknown as { spec: BiSpec; note?: NoteKey };
    const chart = gradeDashboard(c.dataset, key.spec, submission.spec);
    if (!c.noteRequired || !key.note) return chart;
    const note = gradeNote(submission.note, key.note);
    const checks = [...chart.checks, ...note.checks.map((n) => ({ label: `Takeaway: ${n.label.charAt(0).toLowerCase()}${n.label.slice(1)}`, passed: n.passed }))];
    const passed = chart.passed && note.passed;
    return { passed, message: chart.passed && !note.passed ? "The chart is right. Now fix the takeaway: state the standout value, name which one it is, and say what to do." : chart.message, checks };
  },
};
