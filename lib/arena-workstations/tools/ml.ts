import { z } from "zod";
import type { Json } from "@/lib/supabase/types";
import { GenerationRejected, TIME_LIMIT_MINUTES, type GenerationContext, type GeneratedChallenge, type GradeResult, type ToolDefinition } from "../types";
import { hashSeed, makeRng } from "@/lib/workplace/rng";
import { templateTiers } from "@/lib/workplace/tickets/pick";
import { score } from "@/lib/workplace/ml/metrics";
import { ML_TEMPLATES, type MlContent, type MlDraft, type MlKey } from "@/lib/workplace/ml/tickets";
import { generateAiMl } from "@/lib/workplace/ml/ai";
import { ML_ENGINEER_TEMPLATES } from "@/lib/workplace/ml-engineer/tickets";
import { DATA_SCIENCE_ML_TEMPLATES } from "@/lib/workplace/data-science/ml-templates";
import { ANALYST_PYTHON_TEMPLATES } from "@/lib/workplace/analyst-python/templates";
import { isTemplateOnlyArea } from "../template-only";
import { logArenaEvent } from "../log";

/** The user works in a notebook in the browser and submits what it produced: predictions for the hidden test rows, or numbers. No user code runs on the server. */
const SubmissionSchema = z.object({
  predictions: z.array(z.number().finite()).max(5000).optional(),
  answers: z.record(z.string().max(40), z.string().max(40)).optional(),
  /** the notebook source, kept so the explain-your-work interview can ask about it; it is never run or graded */
  code: z.string().max(20000).optional(),
});
export type MlSubmission = z.infer<typeof SubmissionSchema>;

const AI_TRIES = 2;

const challenge = (ctx: GenerationContext, draft: MlDraft, model: string, provider: string): GeneratedChallenge => ({
  title: draft.title,
  category: ctx.areaName,
  requester: `${draft.requester.name} · ${draft.requester.title}`,
  scenario: draft.scenario,
  objective: draft.content.deliverable,
  skill_tags: draft.skillTags,
  time_limit_minutes: TIME_LIMIT_MINUTES[ctx.difficulty] + 15,
  content: draft.content as unknown as Json,
  answer_key: draft.key as unknown as Json,
  origin: { provider, model },
});

function fromTemplates(ctx: GenerationContext): GeneratedChallenge {
  const areaKey = ctx.areaKey ?? "model-training";
  for (const tier of templateTiers([...ML_TEMPLATES, ...ML_ENGINEER_TEMPLATES, ...DATA_SCIENCE_ML_TEMPLATES, ...ANALYST_PYTHON_TEMPLATES], { difficulty: ctx.difficulty, level: ctx.level ?? "fresher", areaKey })) {
    const fresh = tier.filter((t) => !ctx.avoidTitles.includes(t.title));
    const pool = fresh.length ? fresh : tier;
    const rng = makeRng(ctx.ticketSeed ?? hashSeed("ml"));
    const template = pool[rng.int(0, pool.length - 1)];
    return challenge(ctx, template.build(rng), `ml.${template.id}.v1`, "template");
  }
  throw new GenerationRejected("no machine-learning ticket exists for this area");
}

/**
 * A fresh scenario for this user's area and level, described by the AI and accepted only if a plain model can reach the target on the data built from
 * it (lib/workplace/ml/ai.ts). The fixed churn tickets are the safety net so a user is never left without a task.
 */
async function generate(ctx: GenerationContext): Promise<GeneratedChallenge> {
  if (process.env.ML_AI_GENERATION !== "off" && !isTemplateOnlyArea(ctx.areaKey)) {
    let problem: string | undefined;
    for (let attempt = 1; attempt <= AI_TRIES; attempt++) {
      try {
        return challenge(ctx, await generateAiMl(ctx, undefined, problem), "ml.ai.v1", "ai");
      } catch (e) {
        problem = (e as Error).message.slice(0, 200);
        logArenaEvent(e instanceof GenerationRejected ? "generation.validation_failed" : "generation.failed", { area: ctx.areaKey ?? "", tool: "ml_workspace", attempt, reason: (e as Error).message.slice(0, 200) });
      }
    }
  }
  return fromTemplates(ctx);
}

/** A rough band only, never the number: the exact score would let someone recover the hidden labels by trial and error. */
function gradePredictions(key: Extract<MlKey, { kind: "predict" }>, predictions: number[] | undefined, expected: number): GradeResult {
  if (!predictions || predictions.length !== expected) return { passed: false, message: `Submit exactly ${expected} predictions, one per row of test.csv, in the same order.`, checks: [{ label: "One prediction per test row", passed: false }] };
  if (predictions.some((p) => p !== 0 && p !== 1)) return { passed: false, message: "Every prediction must be 0 or 1.", checks: [{ label: "Predictions are 0 or 1", passed: false }] };
  const reached = score(key.metric, key.yTest, predictions);
  const progress = (reached - key.baseline) / (key.threshold - key.baseline);
  const passed = reached >= key.threshold;
  const message = passed ? "Your predictions meet the target on customers you were not shown." : progress >= 0.7 ? "Close: your model is near the target on unseen customers, but not there yet." : "Not there yet: on unseen customers your model is well below the target. Check how you prepared the data and what the model can see.";
  return { passed, message, checks: [{ label: "Predictions reach the target on unseen customers", passed }] };
}

function gradeNumbers(content: MlContent, key: Extract<MlKey, { kind: "numbers" }>, answers: Record<string, string> | undefined): GradeResult {
  const checks = content.fields.map((f) => {
    const given = Number((answers?.[f.key] ?? "").replace(/[₹,\s]/g, ""));
    return { label: f.label, passed: Number.isFinite(given) && (answers?.[f.key] ?? "").trim() !== "" && Math.abs(given - key.expected[f.key]) <= key.tolerance[f.key] };
  });
  const passed = checks.every((c) => c.passed);
  return { passed, message: passed ? "Every number matches." : "Some numbers are off: check the method and the rounding for the failed items.", checks };
}

export const mlTool: ToolDefinition<MlSubmission> = {
  toolType: "ml_workspace",
  generationVersion: "ml.gen.v1",
  gradingVersion: "ml.grade.v1",
  generate,
  submissionSchema: SubmissionSchema,
  async grade(content, answerKey, submission) {
    const c = content as unknown as MlContent;
    const key = answerKey as unknown as MlKey;
    return key.kind === "predict" ? gradePredictions(key, submission.predictions, c.expectedPredictions ?? 0) : gradeNumbers(c, key, submission.answers);
  },
};
