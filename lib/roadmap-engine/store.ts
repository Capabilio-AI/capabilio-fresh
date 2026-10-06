import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { untyped } from "@/lib/org/db";
import type { PreparedRoadmap } from "./prepare";
import { inferTrigger, type Trigger } from "./snapshot";

type Service = SupabaseClient<Database>;

/** The jsonb the database function save_roadmap_version() takes — snake_case, every child list included. */
export function toPayload(p: PreparedRoadmap, trigger: Trigger): Record<string, unknown> {
  const { plan, meta, input } = p;
  const blockedBy = new Map(plan.milestones.filter((m) => m.kind === "SKILL" && m.blockedBySkillId).map((m) => [m.refId, m.blockedBySkillId]));
  return {
    student_id: input.student.id, institution_id: meta.institutionId, branch_key: meta.branchKey, career_id: plan.career.id, curriculum_version_id: meta.curriculumVersionId,
    trigger, mode: meta.mode, snapshot: p.snapshot, hash: p.hash, readiness: plan.readiness, baseline: plan.baselineRecommended, next_best_action: plan.nextBestAction,
    notes: {
      readinessExplanation: plan.readinessExplanation, mandatoryNote: plan.mandatoryNote, learningNotConfigured: plan.learningNotConfigured, certificationNote: plan.certificationNote,
      projectNote: plan.projectNote, arenaNote: plan.arenaNote, semesterEstimated: meta.semesterEstimated, unmatchedCapabilities: meta.unmatchedCapabilities,
      explanationsRejected: p.explanationNotes.rejected, explanationsFailed: p.explanationNotes.failed,
    },
    goals: meta.goals.map((g) => ({ kind: g.kind, career_id: g.careerId, career_name: g.careerName, readiness: g.readiness })),
    gaps: plan.gaps.map((g, i) => ({
      skill_id: g.skillId, skill_name: g.skillName, importance: g.importance, target_level: g.targetLevel, current_level: g.currentLevel, confidence: Number(g.confidence.toFixed(2)),
      verified: g.verified, self_declared_only: g.selfDeclaredOnly, gap: g.gap, coverage: g.coverage, gap_type: g.gapType, stage: g.stage, blocked_by_skill_id: blockedBy.get(g.skillId) ?? null, sort_order: i,
    })),
    courses: plan.subjects.map((s, i) => ({ course_id: s.courseId, title: s.title, year: s.year, semester: s.semester, tier: s.tier, stars: s.stars, score: Number(s.score.toFixed(4)), schedule: s.schedule, facts: s.facts, ai_explanation: p.explanations.get(s.courseId) ?? null, sort_order: i })),
    learning: plan.learning.map((l) => ({ skill_id: l.skillId, skill_name: l.skillName, learning_item_id: l.item.id, title: l.item.title, provider: l.item.provider, url: l.item.url, level_from: l.item.levelFrom, level_to: l.item.levelTo, estimated_hours: l.item.estimatedHours, starts_now: l.startsNow, reason: l.reason })),
    certifications: plan.certifications.map((c) => ({ certification_id: c.cert.id, name: c.cert.name, provider: c.cert.provider, url: c.cert.url, relevance: c.relevance, covered_skill_ids: c.coveredSkillIds })),
    projects: plan.projects.map((x) => ({ project_id: x.project.id, title: x.project.title, difficulty: x.project.difficulty, covered_skill_ids: x.coveredSkillIds, is_ai_recommendation: x.isAiRecommendation })),
    arena: plan.arena.map((a) => ({ challenge_id: a.challenge.id, title: a.challenge.title, difficulty: a.challenge.difficulty, covered_skill_ids: a.coveredSkillIds })),
    milestones: plan.milestones.map((m, i) => ({ kind: m.kind, ref_id: m.refId, title: m.title, horizon: m.horizon, status: m.status, reason: m.reason, optional_exploration: m.optionalExploration, blocked_by_skill_id: m.blockedBySkillId, sort_order: i })),
  };
}

export interface SaveResult {
  created: boolean;
  versionId: string;
  versionNo: number;
  roadmapId: string;
  trigger: Trigger;
}

/** The latest stored version (hash + snapshot) of the student's roadmap for one career, and whether that roadmap is the current one. */
export async function latestVersion(service: Service, studentId: string, careerId: string) {
  const db = untyped(service);
  const { data: rm } = await db.from("roadmaps").select("id, is_current").eq("student_id", studentId).eq("career_id", careerId).maybeSingle();
  if (!rm) return null;
  const { data: v } = await db.from("roadmap_versions").select("id, version_no, input_hash, input_snapshot").eq("roadmap_id", rm.id).order("version_no", { ascending: false }).limit(1).maybeSingle();
  return v ? { roadmapId: rm.id as string, isCurrent: rm.is_current as boolean, versionId: v.id as string, versionNo: v.version_no as number, hash: v.input_hash as string, snapshot: v.input_snapshot as { curriculumVersionId?: string | null } } : null;
}

/**
 * Saves a prepared roadmap through the one atomic database function: serialised per student, a no-op when the inputs hash is unchanged (so
 * calling it again is harmless), a new immutable version otherwise. The trigger recorded says why: the first roadmap for a career, a new
 * curriculum version, new progress — or MANUAL when the student asked.
 */
export async function saveRoadmap(service: Service, prepared: PreparedRoadmap, requested?: "MANUAL"): Promise<SaveResult> {
  const prev = await latestVersion(service, prepared.input.student.id, prepared.plan.career.id);
  // Returning to a career whose roadmap was set aside is a career change, even though that roadmap already has versions.
  const trigger = prev && !prev.isCurrent && requested !== "MANUAL" ? "CAREER_CHANGE" : inferTrigger(prev ? prev.snapshot : null, prepared.snapshot as { curriculumVersionId?: string | null }, requested);
  const { data, error } = await untyped(service).rpc("save_roadmap_version", { p: toPayload(prepared, trigger) });
  if (error) throw new Error(`save_roadmap_version: ${error.message}`);
  const r = data as { created: boolean; version_id: string; version_no: number; roadmap_id: string };
  return { created: r.created, versionId: r.version_id, versionNo: r.version_no, roadmapId: r.roadmap_id, trigger };
}
