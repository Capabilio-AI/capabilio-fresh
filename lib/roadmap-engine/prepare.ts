import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { loadRoadmapContext, type LoadedMeta, type LoadResult } from "./load";
import { generateRoadmap, type RoadmapPlan } from "./generate";
import { buildExplanations, type ExplainFn } from "./explain";
import { canonicalInput, hashSnapshot } from "./snapshot";
import type { EngineInput } from "./types";

export interface PreparedRoadmap {
  status: "READY";
  plan: RoadmapPlan;
  /** the exact engine input the plan was computed from */
  input: EngineInput;
  meta: LoadedMeta;
  /** the exact inputs the plan was computed from — stored with the version, and what the hash is of */
  snapshot: Record<string, unknown>;
  hash: string;
  /** grounded one-sentence explanations by course id (may be empty) */
  explanations: Map<string, string>;
  explanationNotes: { rejected: number; failed: boolean };
}
export type PrepareResult = Exclude<LoadResult, { status: "READY" }> | PreparedRoadmap;

/** The inputs that determine a roadmap — and nothing derived from them, so identical inputs always hash identically. */
export function buildSnapshot(input: EngineInput, meta: LoadedMeta): Record<string, unknown> {
  return {
    mode: meta.mode, career: input.career, requirements: input.requirements, courses: input.courses, capability: input.capability, hasAnyCapabilityData: input.hasAnyCapabilityData,
    position: input.position, catalogs: input.catalogs, curriculumVersionId: meta.curriculumVersionId, regulation: meta.regulation,
    goals: meta.goals.map((g) => ({ kind: g.kind, careerId: g.careerId })),
  };
}

/**
 * Everything short of writing: load the real inputs (or say what is missing), generate the plan, add grounded AI sentences, and compute the input
 * hash. `explain: false` skips the AI entirely; a function injects one (tests). Reads only.
 */
export async function prepareRoadmap(service: SupabaseClient<Database>, userId: string, opts: { now?: Date; explain?: ExplainFn | false } = {}): Promise<PrepareResult> {
  const loaded = await loadRoadmapContext(service, userId, opts.now);
  if (loaded.status !== "READY") return loaded;
  const input = canonicalInput(loaded.input);
  const plan = generateRoadmap(input);
  const snapshot = buildSnapshot(input, loaded.meta);
  const ex = opts.explain === false ? { sentences: new Map<string, string>(), rejected: 0, failed: false } : await buildExplanations(plan.career.name, plan.subjects, loaded.meta.allSkillNames, opts.explain);
  return { status: "READY", plan, input, meta: loaded.meta, snapshot, hash: hashSnapshot(snapshot), explanations: ex.sentences, explanationNotes: { rejected: ex.rejected, failed: ex.failed } };
}
