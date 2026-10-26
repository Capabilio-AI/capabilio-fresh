import { z } from "zod";
import type { Json } from "@/lib/supabase/types";
import { GenerationRejected, TIME_LIMIT_MINUTES, type GenerationContext, type GeneratedChallenge, type GradeResult, type ToolDefinition } from "../types";
import { hashSeed, makeRng } from "@/lib/workplace/rng";
import { templateTiers } from "@/lib/workplace/tickets/pick";
import { CALC_TEMPLATES } from "@/lib/workplace/calc/templates-index";
import type { CalcContent, CalcKey, CalcTemplate } from "@/lib/workplace/calc/types";

const MAX_SUBMISSIONS = 5;

/** The student types numbers into named fields; nothing is run. Values stay strings so "1.2e3" and "1,200" both work. */
const SubmissionSchema = z.object({
  answers: z.record(z.string().max(40), z.string().max(40)).refine((a) => Object.keys(a).length <= 40, "too many answers"),
});
export type CalcSubmission = z.infer<typeof SubmissionSchema>;

/** Template list is a parameter so tests can serve the example set. */
export function buildCalcChallenge(ctx: GenerationContext, templates: readonly CalcTemplate[] = CALC_TEMPLATES): GeneratedChallenge {
  const areaKey = ctx.areaKey ?? "";
  for (const tier of templateTiers(templates, { difficulty: ctx.difficulty, level: ctx.level ?? "fresher", areaKey })) {
    const rng = makeRng(ctx.ticketSeed ?? hashSeed("calc", areaKey));
    const template = tier[rng.int(0, tier.length - 1)];
    const draft = template.build(rng);
    const content: CalcContent = { params: draft.params, fields: draft.fields, reference: draft.reference, maxSubmissions: MAX_SUBMISSIONS, deliverable: "Enter each result in the unit shown." };
    return {
      title: draft.title,
      category: ctx.areaName,
      requester: `${draft.requester.name} · ${draft.requester.title}`,
      scenario: draft.scenario,
      objective: content.deliverable,
      skill_tags: [ctx.areaName],
      time_limit_minutes: TIME_LIMIT_MINUTES[ctx.difficulty],
      content: content as unknown as Json,
      answer_key: draft.key as unknown as Json,
      origin: { provider: "template", model: `calc.${template.id}.v1` },
    };
  }
  throw new GenerationRejected("no calculation ticket exists for this area");
}

/** Parses a typed number; empty or malformed text is NaN. */
const parseNumber = (text: string | undefined): number => {
  const t = (text ?? "").replace(/[₹$,\s]/g, "");
  return t === "" ? NaN : Number(t);
};

export function gradeCalc(content: CalcContent, key: CalcKey, answers: Record<string, string>): GradeResult {
  const checks = content.fields.map((f) => {
    const given = parseNumber(answers[f.key]);
    return { label: f.label, passed: Number.isFinite(given) && Math.abs(given - key.expected[f.key]) <= key.tolerance[f.key] };
  });
  const passed = checks.every((c) => c.passed);
  return { passed, message: passed ? "Every result is within tolerance." : "Some results are off: check the formula, the units and the rounding for the failed items.", checks };
}

export const calcTool: ToolDefinition<CalcSubmission> = {
  toolType: "calc_workspace",
  generationVersion: "calc.gen.v1",
  gradingVersion: "calc.grade.v1",
  async generate(ctx) {
    return buildCalcChallenge(ctx);
  },
  submissionSchema: SubmissionSchema,
  async grade(content, answerKey, submission) {
    return gradeCalc(content as unknown as CalcContent, answerKey as unknown as CalcKey, submission.answers);
  },
};
