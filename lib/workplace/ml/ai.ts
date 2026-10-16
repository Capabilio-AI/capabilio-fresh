import { z } from "zod";
import { completeJson } from "@/lib/ai/groq";
import { GenerationRejected, DIFFICULTY_LABEL, type GenerationContext } from "@/lib/arena-workstations/types";
import { makeRng } from "../rng";
import { DatasetSpecSchema } from "./spec";
import { MATH_OPS, MlRejected, buildEval, buildMath, buildPredict, buildPrep, type MlDraft, type Texts } from "./tickets";

const GenSchema = z.object({
  company: z.string().min(2).max(60),
  requester_name: z.string().min(2).max(40),
  requester_title: z.string().min(2).max(60),
  title: z.string().min(8).max(90),
  scenario: z.string().min(40).max(600),
  spec: DatasetSpecSchema,
  math_op: z.enum(MATH_OPS).optional(),
});

export interface Deps {
  llm<T>(prompt: string, system: string, schema: z.ZodType<T>): Promise<T>;
}
export const realDeps: Deps = { llm: (p, s, schema) => completeJson(p, s, schema, { task: "arena_task" }) };

const SETTINGS = ["a loan lender predicting who will default", "a hospital predicting readmission within 30 days", "an online shop predicting returns", "a bank spotting fraudulent card payments", "a factory predicting machine failure this week", "a delivery company predicting late deliveries", "a school predicting which students will fail a subject", "an insurer predicting who will claim", "a telecom predicting who will leave", "a farm co-operative predicting crop disease", "an app predicting who will cancel a subscription", "a recruiter predicting which candidates accept an offer", "a power utility predicting unpaid bills"];

const SYSTEM = `You design one realistic machine-learning task for a learner, as a request from a colleague at a fictional Indian company. You do not write code or data: you describe the scenario in a JSON "spec" and code builds the dataset from it.

The spec describes a yes/no outcome ("target") and 4-8 columns ("features") that influence it:
- numeric features ("int" or "float") have a range (min, max), an "effect" (change in log-odds from the lowest to the highest value, between -3 and 3), optionally "skew": "right" for things like money or waiting time, optionally a jump ("step_at" with "step_effect"), and a "missing" share (0 to 0.2).
- "category" features have 2-6 levels, each with a "weight" (how common) and an "effect" on the log-odds. Level values are short lower-case words.
- Use at least 2 numeric and 1 category feature. Give 3-4 features a clearly non-zero effect (at least 1.0 in size) and leave a couple with a small effect, so the learner must work out which columns matter. Names are lower_snake_case and realistic for the business.
- "target.prevalence" is the share of rows with the outcome, between 0.05 and 0.5. "entity" is what each row is (for example "patient"). "id_column" names the row id.
- Always include "leak": a column that only exists after the outcome is known (for example a refund issued after the customer left) with a one-line description.
Write "title" (specific, not generic), "scenario" (the colleague's message in their own voice, 2-4 sentences, why they need it and what decision it feeds, no numbers from the data) and who they are. Output JSON only, exactly the requested shape.`;

function brief(ctx: GenerationContext): string {
  const rng = makeRng(ctx.ticketSeed ?? 1);
  const area = ctx.areaKey ?? "model-training";
  const rate = ctx.difficulty === "easy" ? "between 0.3 and 0.5" : ctx.difficulty === "medium" ? "between 0.1 and 0.2" : "between 0.05 and 0.12";
  const task: Record<string, string> = {
    "model-training": `The learner trains a model to predict the outcome for new rows. Set target.prevalence ${rate}.`,
    "pipeline-debugging": `The learner debugs a model that looks perfect in training and fails on new rows because of the leaked column. Set target.prevalence ${rate}. The scenario says the colleague's model did great on history and badly on new rows, without naming the cause.`,
    "data-preparation": "The learner cleans a messy export of this data (duplicates, gaps, inconsistent category spelling) before modelling. The scenario is about the export being a mess.",
    evaluation: "The learner checks whether a model that looks accurate is really good, on a rare outcome (set target.prevalence between 0.06 and 0.25). The scenario is about not trusting the headline accuracy.",
    "ml-fundamentals": `The learner works one piece of the maths of training by hand. Also return "math_op": one of ${MATH_OPS.join(", ")}. The scenario is about wanting the new hire to understand what training really does, in this business.`,
  };
  return `Area: ${ctx.areaName}. Difficulty: ${DIFFICULTY_LABEL[ctx.difficulty]}. Experience of the learner: ${ctx.level ?? "fresher"}.
Setting: ${rng.pick(SETTINGS)}.
${task[area] ?? task["model-training"]}
${ctx.avoidTitles.length ? `Do not reuse or rephrase these earlier titles, and pick a different business and different columns:\n- ${ctx.avoidTitles.slice(0, 20).join("\n- ")}` : ""}`;
}

/** One fresh scenario for this user's area and level. The AI only describes it; it is served only if a plain model can reach the target on the data built from it. */
export async function generateAiMl(ctx: GenerationContext, deps: Deps = realDeps, previousProblem?: string): Promise<MlDraft> {
  const area = ctx.areaKey ?? "model-training";
  const retry = previousProblem ? `\nYour previous attempt was rejected because: ${previousProblem}. Choose columns whose effects are clearly strong enough for a model to learn.` : "";
  const raw = await deps.llm(`Create the task.\n${brief(ctx)}${retry}`, SYSTEM, GenSchema);
  if (ctx.avoidTitles.some((t) => t.trim().toLowerCase() === raw.title.trim().toLowerCase())) throw new GenerationRejected("title repeats an earlier ticket");
  const texts: Texts = { company: raw.company, title: raw.title, scenario: raw.scenario, requester: { name: raw.requester_name, title: raw.requester_title } };
  const rng = makeRng((ctx.ticketSeed ?? 1) ^ 0x9e3779b9);
  try {
    switch (area) {
      case "model-training": return buildPredict(raw.spec, rng, ctx.difficulty, texts);
      case "pipeline-debugging": return buildPredict(raw.spec, rng, ctx.difficulty, texts, { leak: true });
      case "data-preparation": return buildPrep(raw.spec, rng, texts);
      case "evaluation": return buildEval(raw.spec, rng, texts);
      case "ml-fundamentals":
        if (!raw.math_op) throw new GenerationRejected("a fundamentals task needs a math_op");
        return buildMath(raw.math_op, rng, texts);
      default: throw new GenerationRejected(`no machine-learning ticket exists for area ${area}`);
    }
  } catch (e) {
    if (e instanceof MlRejected) throw new GenerationRejected(e.message);
    throw e;
  }
}
