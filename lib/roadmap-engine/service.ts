import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { prepareRoadmap, type PrepareResult } from "./prepare";
import { buildExplanations, type ExplainFn } from "./explain";
import { latestVersion, saveRoadmap, type SaveResult } from "./store";
import { getRoadmapVersionView, type RoadmapView } from "./read";

type Service = SupabaseClient<Database>;

export type RoadmapOutcome =
  | Exclude<PrepareResult, { status: "READY" }>
  | { status: "READY"; created: boolean; trigger: SaveResult["trigger"] | null; view: RoadmapView; explanationNotes: { rejected: number; failed: boolean } };

/**
 * The one entry point: make sure the student's roadmap reflects their CURRENT inputs, and return it. Regeneration is hash-on-read — the inputs
 * (career goal, published curriculum version, capability and Arena evidence, semester) are loaded and hashed, and only if that differs from the
 * latest stored version is a new immutable version written. Same inputs ⇒ nothing is written and no AI is called. This one rule covers every
 * trigger: a career change, a published curriculum, new verified evidence, a new semester, or the student pressing "Refresh" (`refresh`, which
 * is labelled MANUAL if it does produce a version). Idempotent and safe to call concurrently.
 */
export async function ensureRoadmap(service: Service, userId: string, opts: { refresh?: boolean; explain?: ExplainFn | false; now?: Date } = {}): Promise<RoadmapOutcome> {
  const prep = await prepareRoadmap(service, userId, { now: opts.now, explain: false });
  if (prep.status !== "READY") return prep;

  const latest = await latestVersion(service, userId, prep.plan.career.id);
  if (latest && latest.hash === prep.hash && latest.isCurrent) {
    const view = await getRoadmapVersionView(service, userId, latest.versionId);
    if (view) return { status: "READY", created: false, trigger: null, view, explanationNotes: { rejected: 0, failed: false } };
  }

  // Something changed (or this is the first one): add grounded AI sentences, then save atomically.
  const ex = opts.explain === false ? { sentences: new Map<string, string>(), rejected: 0, failed: false } : await buildExplanations(prep.plan.career.name, prep.plan.subjects, prep.meta.allSkillNames, opts.explain);
  const saved = await saveRoadmap(service, { ...prep, explanations: ex.sentences, explanationNotes: { rejected: ex.rejected, failed: ex.failed } }, opts.refresh ? "MANUAL" : undefined);
  const view = await getRoadmapVersionView(service, userId, saved.versionId);
  if (!view) throw new Error("A roadmap version was saved but could not be read back.");
  return { status: "READY", created: saved.created, trigger: saved.created ? saved.trigger : null, view, explanationNotes: { rejected: ex.rejected, failed: ex.failed } };
}
