import { z } from "zod";
import type { Json } from "@/lib/supabase/types";
import { GenerationRejected, TIME_LIMIT_MINUTES, type GenerationContext, type GeneratedChallenge, type GradeResult, type ToolDefinition } from "../types";
import { hashSeed, makeRng } from "@/lib/workplace/rng";
import { templateTiers } from "@/lib/workplace/tickets/pick";
import { gradePipeline } from "@/lib/workplace/pipeline/checks";
import { PIPELINE_TEMPLATES, type PipelineKey } from "@/lib/workplace/pipeline/templates";

/**
 * Pipeline Lab (tier S). The user edits a pipeline spec; the server parses it and simulates the daily runs, a re-run backfill and the quality gate over
 * synthetic batches, then checks invariants on the result. It models Airflow / dbt / Spark ideas in plain TypeScript; no scheduler or cluster runs, and
 * nothing the user writes is executed. Tickets are the fixed, tested templates only (no AI generation yet).
 */
const SubmissionSchema = z.object({ spec: z.string().max(4000) });
export type PipelineSubmission = z.infer<typeof SubmissionSchema>;

async function generate(ctx: GenerationContext): Promise<GeneratedChallenge> {
  const areaKey = ctx.areaKey ?? "pipelines";
  for (const tier of templateTiers(PIPELINE_TEMPLATES, { difficulty: ctx.difficulty, level: ctx.level ?? "fresher", areaKey })) {
    const fresh = tier.filter((t) => !ctx.avoidTitles.includes(t.draft.title));
    const pool = fresh.length ? fresh : tier;
    const t = pool[makeRng(ctx.ticketSeed ?? hashSeed("pipeline")).int(0, pool.length - 1)];
    return {
      title: t.draft.title,
      category: ctx.areaName,
      requester: `${t.draft.requester.name} · ${t.draft.requester.title}`,
      scenario: t.draft.scenario,
      objective: t.draft.content.deliverable,
      skill_tags: t.draft.skillTags,
      time_limit_minutes: TIME_LIMIT_MINUTES[ctx.difficulty] + 10,
      content: t.draft.content as unknown as Json,
      answer_key: t.draft.key as unknown as Json,
      origin: { provider: "template", model: `pipeline.${t.id}.v1` },
    };
  }
  throw new GenerationRejected("no pipeline ticket exists for this area");
}

export const pipelineTool: ToolDefinition<PipelineSubmission> = {
  toolType: "pipeline_workspace",
  generationVersion: "pipeline.gen.v1",
  gradingVersion: "pipeline.grade.v1",
  generate,
  submissionSchema: SubmissionSchema,
  async grade(_content, answerKey, submission): Promise<GradeResult> {
    // the scenario is taken from the server-held key, never from anything the client sent
    const key = answerKey as unknown as PipelineKey;
    const g = gradePipeline(submission.spec, key.scenario, key.checks);
    const passed = g.checks.length > 0 && g.checks.every((c) => c.passed);
    const failing = g.checks.filter((c) => !c.passed).length;
    const message = g.error ? `The pipeline could not run: ${g.error}` : passed ? "Every requirement is met." : `${failing} of ${g.checks.length} requirements are not met yet. Check the ones marked below.`;
    const runs = g.simulation ? [...g.simulation.runs, ...g.simulation.backfill].map((r) => ({ label: r.label, status: r.status, reason: r.reason ?? null, written: r.written })) : [];
    return { passed, message, checks: g.checks, detail: { runs } as unknown as Json };
  },
};
