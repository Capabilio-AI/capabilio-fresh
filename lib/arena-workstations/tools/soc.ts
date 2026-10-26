import { z } from "zod";
import type { Json } from "@/lib/supabase/types";
import { GenerationRejected, TIME_LIMIT_MINUTES, type GenerationContext, type GeneratedChallenge, type GradeResult, type ToolDefinition } from "../types";
import { hashSeed, makeRng } from "@/lib/workplace/rng";
import { templateTiers } from "@/lib/workplace/tickets/pick";
import { buildShift } from "@/lib/workplace/soc/generator";
import { gradeShift } from "@/lib/workplace/soc/checks";
import { SOC_TEMPLATES } from "@/lib/workplace/soc/templates";
import type { SocContent, SocKey } from "@/lib/workplace/soc/types";

/**
 * SOC Console (W19, tier S). The shift is a deterministic simulation built from a seed; the student searches its logs in the browser and submits a
 * decision per alert. Grading compares those decisions with the key derived from the same seed, on the server. No AI and no user code are involved.
 */
const AnswerSchema = z.object({
  disposition: z.string().max(40).optional(),
  severity: z.string().max(20).optional(),
  technique: z.string().max(20).optional(),
  action: z.string().max(40).optional(),
  escalate: z.boolean().optional(),
  evidence: z.array(z.string().max(12)).max(40).optional(),
});
const SubmissionSchema = z.object({
  alerts: z.record(z.string().max(20), AnswerSchema).refine((a) => Object.keys(a).length <= 10, "too many alerts"),
  /** the analyst's findings note, kept for the explain-your-work interview; it is not graded */
  note: z.string().max(2000).optional(),
});
export type SocSubmission = z.infer<typeof SubmissionSchema>;

async function generate(ctx: GenerationContext): Promise<GeneratedChallenge> {
  const areaKey = ctx.areaKey ?? "alert-triage";
  const seed = ctx.ticketSeed ?? hashSeed("soc", areaKey, ctx.difficulty);
  const [tier] = templateTiers(SOC_TEMPLATES, { difficulty: ctx.difficulty, level: ctx.level ?? "fresher", areaKey });
  if (!tier) throw new GenerationRejected("no SOC ticket exists for this area");
  const fresh = tier.filter((t) => !ctx.avoidTitles.includes(t.title));
  const pool = fresh.length ? fresh : tier;
  const template = pool[makeRng(seed).int(0, pool.length - 1)];
  const { content, key } = buildShift(seed, template.families, template.ask);
  return {
    title: template.title,
    category: ctx.areaName,
    requester: `${template.requester.name} · ${template.requester.title}`,
    scenario: template.scenario,
    objective: content.deliverable,
    skill_tags: template.skillTags,
    time_limit_minutes: TIME_LIMIT_MINUTES[ctx.difficulty] + 15,
    content: content as unknown as Json,
    answer_key: key as unknown as Json,
    origin: { provider: "template", model: `soc.${template.id}.v1` },
  };
}

export const socTool: ToolDefinition<SocSubmission> = {
  toolType: "soc_workspace",
  generationVersion: "soc.gen.v1",
  gradingVersion: "soc.grade.v1",
  generate,
  submissionSchema: SubmissionSchema,
  async grade(content, answerKey, submission): Promise<GradeResult> {
    const checks = gradeShift(content as unknown as SocContent, answerKey as unknown as SocKey, submission);
    const failing = checks.filter((c) => !c.passed).length;
    const passed = checks.length > 0 && failing === 0;
    return { passed, message: passed ? "Every decision matches what the logs show." : `${failing} of ${checks.length} decisions do not match the evidence yet. Go back to the logs and the runbook for the ones marked below.`, checks };
  },
};
