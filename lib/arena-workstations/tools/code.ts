import { z } from "zod";
import type { Json } from "@/lib/supabase/types";
import { GenerationRejected, TIME_LIMIT_MINUTES, type GenerationContext, type GeneratedChallenge, type GradeResult, type ToolDefinition } from "../types";
import { hashSeed, makeRng } from "@/lib/workplace/rng";
import { templateTiers } from "@/lib/workplace/tickets/pick";
import { same } from "@/lib/workplace/code/compare";
import { CODE_PROBLEMS, EXAMPLE_COUNT, type CodeContent, type CodeDraft, type CodeKey } from "@/lib/workplace/code/problems";
import { generateAiProblem } from "@/lib/workplace/code/ai";
import { EMBEDDED_CODE_PROBLEMS } from "@/lib/workplace/embedded/code-problems";
import { IOT_CODE_PROBLEMS } from "@/lib/workplace/iot/code-problems";
import { PLC_CODE_PROBLEMS } from "@/lib/workplace/plc/code-problems";
import { APP_DEV_CODE_PROBLEMS } from "@/lib/workplace/application-developer/code-problems";
import { isTemplateOnlyArea } from "../template-only";
import { logArenaEvent } from "../log";

/** The user's function runs in their browser on every case; they submit what it returned, and the server compares it with its own answers. */
const SubmissionSchema = z.object({
  language: z.enum(["python", "javascript"]),
  outputs: z.array(z.object({ ok: z.boolean(), value: z.unknown().optional(), error: z.string().max(300).optional() })).max(60),
  /** kept for the explain-your-work interview; never run or graded */
  code: z.string().max(20000).optional(),
});
export type CodeSubmission = z.infer<typeof SubmissionSchema>;

const AI_TRIES = 2;

const challenge = (ctx: GenerationContext, draft: CodeDraft, model: string, provider: string): GeneratedChallenge => ({
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
  const areaKey = ctx.areaKey ?? "fundamentals";
  for (const tier of templateTiers([...CODE_PROBLEMS, ...APP_DEV_CODE_PROBLEMS, ...EMBEDDED_CODE_PROBLEMS, ...IOT_CODE_PROBLEMS, ...PLC_CODE_PROBLEMS], { difficulty: ctx.difficulty, level: ctx.level ?? "fresher", areaKey })) {
    const fresh = tier.filter((p) => !ctx.avoidTitles.some((t) => p.build(makeRng(0)).title === t));
    const pool = fresh.length ? fresh : tier;
    const rng = makeRng(ctx.ticketSeed ?? hashSeed("code"));
    const problem = pool[rng.int(0, pool.length - 1)];
    return challenge(ctx, problem.build(rng), `code.${problem.id}.v1`, "template");
  }
  throw new GenerationRejected("no programming ticket exists for this area");
}

/**
 * A fresh exercise for this user's area and level, written by the AI and accepted only after its own code proves it fair (see
 * lib/workplace/code/ai.ts). If that keeps failing, the fixed problems are a safety net so the user is never left without a ticket.
 */
async function generate(ctx: GenerationContext): Promise<GeneratedChallenge> {
  if (process.env.CODE_AI_GENERATION !== "off" && !isTemplateOnlyArea(ctx.areaKey)) {
    let problem: string | undefined;
    for (let attempt = 1; attempt <= AI_TRIES; attempt++) {
      try {
        return challenge(ctx, await generateAiProblem(ctx, undefined, problem), "code.ai.v1", "ai");
      } catch (e) {
        problem = (e as Error).message.slice(0, 200);
        logArenaEvent(e instanceof GenerationRejected ? "generation.validation_failed" : "generation.failed", { area: ctx.areaKey ?? "", tool: "code_workspace", attempt, reason: (e as Error).message.slice(0, 200) });
      }
    }
  }
  return fromTemplates(ctx);
}

export const codeTool: ToolDefinition<CodeSubmission> = {
  toolType: "code_workspace",
  generationVersion: "code.gen.v1",
  gradingVersion: "code.grade.v1",
  generate,
  submissionSchema: SubmissionSchema,
  async grade(content, answerKey, submission): Promise<GradeResult> {
    const c = content as unknown as CodeContent;
    const key = answerKey as unknown as CodeKey;
    if (submission.outputs.length !== key.expected.length) {
      return { passed: false, message: `Your code must be run on all ${key.expected.length} cases. Submit from the editor so every case runs.`, checks: [{ label: "All cases ran", passed: false }] };
    }
    const results = key.expected.map((expected, i) => ({ i, passed: submission.outputs[i].ok && same(submission.outputs[i].value, expected) }));
    const failed = results.filter((r) => !r.passed);
    const checks = [
      { label: "The examples in the task", passed: results.slice(0, EXAMPLE_COUNT).every((r) => r.passed) },
      { label: "Further cases you were not shown the answers to", passed: results.slice(EXAMPLE_COUNT).every((r) => r.passed) },
    ];
    if (failed.length === 0) return { passed: true, message: "Your function gave the right answer on every case.", checks };
    // reveal one failing case (never the rest), so it helps debugging without handing over all the answers
    const first = failed.find((r) => r.i >= EXAMPLE_COUNT) ?? failed[0];
    const out = submission.outputs[first.i];
    const show = (v: unknown) => { const t = JSON.stringify(v) ?? "null"; return t.length > 160 ? `${t.slice(0, 160)}…` : t; };
    const got = out.ok ? show(out.value) : `an error (${out.error ?? "it raised an error"})`;
    return {
      passed: false,
      message: `${failed.length} of ${results.length} cases are wrong. For example, with input ${show(c.cases[first.i])} the answer should be ${show(key.expected[first.i])} but your function gave ${got}.`,
      checks,
      detail: { failedCase: { args: c.cases[first.i], expected: key.expected[first.i], got: out.ok ? (out.value ?? null) : null, error: out.ok ? null : (out.error ?? "it raised an error") } } as unknown as Json,
    };
  },
};
