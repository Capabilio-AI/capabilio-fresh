import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { untyped } from "@/lib/org/db";

type Service = SupabaseClient<Database>;

export interface TopicNode { skillId: string; importance: "CORE" | "RECOMMENDED" | "OPTIONAL"; stage: "FOUNDATION" | "CORE" | "SPECIALIZATION" | "JOB_READY"; targetLevel: number; order: number }
export interface RequirementRow {
  skill_id: string;
  importance: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  target_level: number;
  required_by_stage: "FOUNDATION" | "INTERMEDIATE" | "JOB_READY";
  assessment_weight: number;
  min_questions: number;
  max_questions: number;
}

const LADDER = { CRITICAL: { weight: 4, min: 2, max: 4, rank: 0 }, HIGH: { weight: 3, min: 1, max: 3, rank: 1 }, MEDIUM: { weight: 2, min: 1, max: 2, rank: 2 }, LOW: { weight: 1, min: 0, max: 1, rank: 3 } } as const;
const STAGE = { FOUNDATION: "FOUNDATION", CORE: "INTERMEDIATE", SPECIALIZATION: "JOB_READY", JOB_READY: "JOB_READY" } as const;

const importanceOf = (n: TopicNode): RequirementRow["importance"] => (n.importance === "CORE" ? (n.stage === "FOUNDATION" ? "CRITICAL" : "HIGH") : n.importance === "RECOMMENDED" ? "MEDIUM" : "LOW");

/**
 * Pure. The skill profile a roadmap implies: each topic's skill with an importance and target from the topic itself, weights and question
 * ranges the same as every other role, one row per skill (its strongest topic wins). Every skill on the roadmap is kept, because a role needs as
 * many as it needs; the most important come first, and the assessment spreads its questions across them by weight.
 */
export function deriveRequirements(topics: readonly TopicNode[]): RequirementRow[] {
  const best = new Map<string, TopicNode>();
  for (const t of topics) {
    const have = best.get(t.skillId);
    if (!have || LADDER[importanceOf(t)].rank < LADDER[importanceOf(have)].rank) best.set(t.skillId, t);
  }
  return [...best.values()]
    .sort((a, b) => LADDER[importanceOf(a)].rank - LADDER[importanceOf(b)].rank || a.order - b.order)
    .map((t) => {
      const importance = importanceOf(t);
      const l = LADDER[importance];
      return { skill_id: t.skillId, importance, target_level: t.targetLevel, required_by_stage: STAGE[t.stage], assessment_weight: l.weight, min_questions: l.min, max_questions: l.max };
    });
}

/**
 * Gives a career that has a published roadmap but no skill profile the one its roadmap implies, so it can be assessed, scored and matched to
 * projects. A career that already has a profile is never touched. Returns how many skills were added (0 when nothing was needed); with dryRun, how many would be.
 */
export async function ensureRequirements(service: Service, careerId: string, opts: { dryRun?: boolean } = {}): Promise<number> {
  const db = untyped(service);
  const { count } = await db.from("career_skill_requirements").select("skill_id", { count: "exact", head: true }).eq("career_id", careerId);
  if ((count ?? 0) > 0) return 0;
  const rows = await publishedRows(service, careerId);
  if (rows.length === 0 || opts.dryRun) return rows.length;
  const { error } = await db.from("career_skill_requirements").upsert(rows.map((r) => ({ ...r, career_id: careerId })), { onConflict: "career_id,skill_id", ignoreDuplicates: true });
  if (error) throw error;
  return rows.length;
}

/**
 * Makes the career's skill profile equal to its published roadmap: skills the roadmap no longer has are removed from the profile, the rest take the
 * roadmap's importance and target. The assessment, readiness, Pulse and Arena all read this profile, so after a roadmap is replaced it must follow it.
 * Students' measured evidence is keyed by skill and is not touched. Returns the number of skills in the profile afterwards (0 = left unchanged).
 */
export async function replaceRequirements(service: Service, careerId: string): Promise<number> {
  const db = untyped(service);
  const rows = await publishedRows(service, careerId);
  if (rows.length === 0) return 0;
  const { error } = await db.from("career_skill_requirements").upsert(rows.map((r) => ({ ...r, career_id: careerId })), { onConflict: "career_id,skill_id" });
  if (error) throw error;
  const { error: removeError } = await db.from("career_skill_requirements").delete().eq("career_id", careerId).not("skill_id", "in", `(${rows.map((r) => r.skill_id).join(",")})`);
  if (removeError) throw removeError;
  await deactivateOffProfileQuestions(service, careerId, rows.map((r) => r.skill_id));
  return rows.length;
}

/**
 * The role's assessment questions for skills that left its profile stop being served. Deactivated, not deleted: past sessions still point at them.
 * This also un-fills the role's question bank, so the background warm-up creates questions for the skills that joined the profile.
 */
export async function deactivateOffProfileQuestions(service: Service, careerId: string, keepSkillIds: readonly string[]): Promise<void> {
  const { error } = await untyped(service).from("assess_question_pool").update({ is_active: false }).eq("layer", "CAREER").eq("career_id", careerId).eq("is_active", true).not("skill_id", "in", `(${keepSkillIds.join(",")})`);
  if (error) throw error;
}

async function publishedRows(service: Service, careerId: string): Promise<RequirementRow[]> {
  const db = untyped(service);
  const { data: template } = await db.from("roadmap_templates").select("id").eq("career_id", careerId).eq("status", "PUBLISHED").maybeSingle();
  if (!template) return [];
  const { data: nodes } = await db.from("roadmap_nodes").select("skill_id, importance, stage, target_level, sort_order").eq("template_id", (template as { id: string }).id).eq("type", "TOPIC");
  const topics: TopicNode[] = ((nodes ?? []) as { skill_id: string | null; importance: TopicNode["importance"]; stage: TopicNode["stage"]; target_level: number | null; sort_order: number }[])
    .flatMap((n) => (n.skill_id && n.target_level !== null ? [{ skillId: n.skill_id, importance: n.importance, stage: n.stage, targetLevel: n.target_level, order: n.sort_order }] : []));
  // only skills that are still active can be required of a role
  const ids = [...new Set(topics.map((t) => t.skillId))];
  const { data: active } = ids.length ? await service.from("skills").select("id").in("id", ids).eq("status", "active") : { data: [] };
  const live = new Set((active ?? []).map((s) => s.id));
  return deriveRequirements(topics.filter((t) => live.has(t.skillId)));
}
