import { z } from "zod";
import type { Json } from "@/lib/supabase/types";
import { GenerationRejected, TIME_LIMIT_MINUTES, type GenerationContext, type GeneratedChallenge, type GradeResult, type ToolDefinition } from "../types";
import { hashSeed, makeRng } from "@/lib/workplace/rng";
import { templateTiers } from "@/lib/workplace/tickets/pick";
import type { CheckResult, ConfigFile, FileContent, FileDraft, FileTemplate } from "@/lib/workplace/file-tasks/types";
import { isTemplateOnlyArea } from "../template-only";
import { logArenaEvent } from "../log";

/** The user edits files in the browser and submits them; the server runs its own checks on the text. Nothing the user writes is executed. */
const SubmissionSchema = z.object({
  files: z.array(z.object({ name: z.string().max(60), content: z.string().max(20000) })).min(1).max(4),
});
export type FileSubmission = z.infer<typeof SubmissionSchema>;

const AI_TRIES = 2;

export interface FileTaskToolConfig<K extends { label: string; file: string }> {
  toolType: string;
  generationVersion: string;
  gradingVersion: string;
  /** the area served when the context names none */
  defaultArea: string;
  /** an env var that, set to "off", skips the AI (tests, outages) */
  aiSwitch: string;
  /** short name used in the recorded model, for example "devops" */
  family: string;
  templates: readonly FileTemplate<K>[];
  generateAi(ctx: GenerationContext, previousProblem?: string): Promise<FileDraft<K>>;
  run(files: readonly ConfigFile[], checks: readonly K[]): CheckResult[];
}

/**
 * A workstation where the user edits files and the server checks them against rules. The AI writes a fresh ticket for the user's area and level, and it is
 * served only after it proves itself fair (lib/workplace/file-tasks/generate.ts); fixed tickets are the safety net so a user is never left without one.
 */
export function makeFileTaskTool<K extends { label: string; file: string }>(cfg: FileTaskToolConfig<K>): ToolDefinition<FileSubmission> {
  const challenge = (ctx: GenerationContext, draft: FileDraft<K>, model: string, provider: string): GeneratedChallenge => ({
    title: draft.title,
    category: ctx.areaName,
    requester: `${draft.requester.name} · ${draft.requester.title}`,
    scenario: draft.scenario,
    objective: draft.content.deliverable,
    skill_tags: draft.skillTags,
    time_limit_minutes: TIME_LIMIT_MINUTES[ctx.difficulty] + 10,
    content: draft.content as unknown as Json,
    answer_key: draft.key as unknown as Json,
    origin: { provider, model },
  });

  function fromTemplates(ctx: GenerationContext): GeneratedChallenge {
    const areaKey = ctx.areaKey ?? cfg.defaultArea;
    for (const tier of templateTiers([...cfg.templates], { difficulty: ctx.difficulty, level: ctx.level ?? "fresher", areaKey })) {
      const fresh = tier.filter((t) => !ctx.avoidTitles.includes(t.draft.title));
      const pool = fresh.length ? fresh : tier;
      const template = pool[makeRng(ctx.ticketSeed ?? hashSeed(cfg.family)).int(0, pool.length - 1)];
      return challenge(ctx, template.draft, `${cfg.family}.${template.id}.v1`, "template");
    }
    throw new GenerationRejected(`no ${cfg.family} ticket exists for this area`);
  }

  async function generate(ctx: GenerationContext): Promise<GeneratedChallenge> {
    if (process.env[cfg.aiSwitch] !== "off" && !isTemplateOnlyArea(ctx.areaKey)) {
      let problem: string | undefined;
      for (let attempt = 1; attempt <= AI_TRIES; attempt++) {
        try {
          return challenge(ctx, await cfg.generateAi(ctx, problem), `${cfg.family}.ai.v1`, "ai");
        } catch (e) {
          problem = (e as Error).message.slice(0, 200);
          logArenaEvent(e instanceof GenerationRejected ? "generation.validation_failed" : "generation.failed", { area: ctx.areaKey ?? "", tool: cfg.toolType, attempt, reason: problem });
        }
      }
    }
    return fromTemplates(ctx);
  }

  return {
    toolType: cfg.toolType,
    generationVersion: cfg.generationVersion,
    gradingVersion: cfg.gradingVersion,
    generate,
    submissionSchema: SubmissionSchema,
    async grade(content, answerKey, submission): Promise<GradeResult> {
      const c = content as unknown as FileContent;
      const key = answerKey as unknown as { checks: K[] };
      const checks = cfg.run(submission.files, key.checks);
      const passed = checks.every((r) => r.passed);
      const failing = checks.filter((r) => !r.passed).length;
      return { passed, message: passed ? "Every requirement is met." : `${failing} of ${checks.length} requirements are not met yet. Check the ones marked below.`, checks, detail: { files: c.files.length } as unknown as Json };
    },
  };
}
