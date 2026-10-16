import { z } from "zod";
import type { Json } from "@/lib/supabase/types";
import type { Dataset } from "../engines/dataset";
import { GenerationRejected, type GenerationContext, type GeneratedChallenge, type GradeResult, type ToolDefinition } from "../types";
import { hashSeed, makeRng } from "@/lib/workplace/rng";
import { pickOffice } from "@/lib/workplace/office/pick";
import { checkInvestigation } from "@/lib/workplace/investigate/check";
import type { AnswerField, AnswerValue } from "@/lib/workplace/investigate/types";
import { worldForRole, type World } from "@/lib/workplace/worlds";

/** What the user sees: the company's data (with the fault in it) and the form to report their findings. Never the answers. */
export interface InvestigationContent {
  company: string;
  tables: Dataset[];
  fields: AnswerField[];
  kind: "detective" | "incident";
  /** the exploration queries run with the same plain-query path as an SQL ticket */
  mode: "query";
  engine: "sqlite";
  deliverable: string;
}

interface InvestigationKey {
  answers: Record<string, AnswerValue>;
  tolerance: Record<string, number>;
}

/** Investigations take longer than a single query, so they get a longer clock. */
const INVESTIGATION_MINUTES = { easy: 15, medium: 25, hard: 35 } as const;

const normalise = (v: AnswerValue) => String(v).trim().toLowerCase().replace(/\s+/g, " ");

/** "₹ 1,250.50", "1250.5" and 1250.5 are all the number 1250.5; anything else is not a number. */
export function parseAmount(v: AnswerValue): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const cleaned = v.replace(/[₹,\s]/g, "");
  return /^-?\d+(\.\d+)?$/.test(cleaned) ? Number(cleaned) : null;
}

function generateFromWorld(ctx: GenerationContext, world: World): GeneratedChallenge {
  const picked = pickOffice(
    { templates: world.investigations!, areaKey: ctx.areaKey ?? "investigation", difficulty: ctx.difficulty, level: ctx.level ?? "fresher", rng: makeRng(ctx.ticketSeed ?? hashSeed("investigate")), avoidTitles: ctx.avoidTitles, tables: world.generate(ctx.worldSeed!), tries: 20 },
    checkInvestigation
  );
  if (!picked) throw new GenerationRejected("no valid investigation could be built for this user");
  const { draft } = picked;
  const content: InvestigationContent = {
    company: world.name, tables: draft.tables, fields: draft.fields, kind: draft.mode, mode: "query", engine: "sqlite",
    deliverable: draft.fields.map((f, i) => `${i + 1}. ${f.label}`).join("\n"),
  };
  const key: InvestigationKey = { answers: draft.answers, tolerance: draft.tolerance };
  return {
    title: draft.title,
    category: ctx.areaName,
    requester: `${draft.requester.name} · ${draft.requester.title}`,
    scenario: draft.scenario,
    objective: content.deliverable,
    skill_tags: draft.skillTags,
    time_limit_minutes: INVESTIGATION_MINUTES[ctx.difficulty],
    content: content as unknown as Json,
    answer_key: key as unknown as Json,
    origin: { provider: "template", model: `${world.key}.investigation.v1` },
  };
}

async function generate(ctx: GenerationContext): Promise<GeneratedChallenge> {
  const world = worldForRole(ctx.roleKey);
  if (!world?.investigations || ctx.worldSeed === undefined) throw new GenerationRejected("this role has no investigations yet");
  return generateFromWorld(ctx, world);
}

const SubmissionSchema = z.object({
  answers: z.record(z.string().max(40), z.union([z.string().max(200), z.number().finite()])),
  note: z.string().max(2000).optional(),
});
export type InvestigationSubmission = z.infer<typeof SubmissionSchema>;

function gradeField(field: AnswerField, expected: AnswerValue, tolerance: number, given: AnswerValue | undefined): boolean {
  if (given === undefined || String(given).trim() === "") return false;
  if (field.type !== "number") return normalise(given) === normalise(expected);
  const a = parseAmount(given);
  const b = parseAmount(expected);
  return a !== null && b !== null && Math.abs(a - b) <= tolerance;
}

export const investigationTool: ToolDefinition<InvestigationSubmission> = {
  toolType: "investigation_workspace",
  generationVersion: "investigation.gen.v1",
  gradingVersion: "investigation.grade.v1",
  generate,
  submissionSchema: SubmissionSchema,
  async grade(content, answerKey, submission): Promise<GradeResult> {
    const c = content as unknown as InvestigationContent;
    const key = answerKey as unknown as InvestigationKey;
    const checks = c.fields.map((f) => ({ label: f.label, passed: gradeField(f, key.answers[f.key], key.tolerance[f.key] ?? 0, submission.answers[f.key]) }));
    const passed = checks.every((x) => x.passed);
    return {
      passed,
      message: passed ? "Your findings match what the data shows." : `${checks.filter((x) => !x.passed).length} of ${checks.length} findings do not match the data. Go back to the data and check them.`,
      checks,
    };
  },
};
