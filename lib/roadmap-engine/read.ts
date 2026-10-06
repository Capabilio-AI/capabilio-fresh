import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { untyped } from "@/lib/org/db";
import type { GapRow, MilestoneRow, NextBestAction } from "./types";

type Service = SupabaseClient<Database>;

export interface RoadmapView {
  roadmapId: string;
  versionId: string;
  versionNo: number;
  generatedAt: string;
  trigger: "CAREER_CHANGE" | "CURRICULUM_PUBLISHED" | "PROGRESS_UPDATE" | "MANUAL";
  mode: "STANDARD" | "EXPLORING";
  isCurrent: boolean;
  /** this is the newest version of its roadmap */
  isLatest: boolean;
  career: { id: string; name: string };
  readiness: number;
  baselineRecommended: boolean;
  goals: { kind: "PRIMARY" | "PLAN_B" | "EXPLORING_ALT"; careerId: string | null; careerName: string; readiness: number | null }[];
  gaps: (Omit<GapRow, "coverageCourseIds" | "coverageOutcomeCount" | "parentSkillId" | "met"> & { blockedBySkillId: string | null })[];
  subjects: { courseId: string | null; title: string; year: number; semester: number | null; tier: string; stars: number; schedule: string; facts: { skillNames: string[]; outcomeCount: number; gapPoints: number }; aiExplanation: string | null }[];
  learning: { skillName: string; title: string; provider: string; url: string | null; levelFrom: number; levelTo: number; estimatedHours: number | null; startsNow: boolean; reason: string }[];
  certifications: { name: string; provider: string; url: string | null; relevance: "REQUIRED" | "RECOMMENDED" | "OPTIONAL" }[];
  projects: { title: string; difficulty: string; isAiRecommendation: boolean; status: string }[];
  arena: { challengeId: string | null; title: string; difficulty: string }[];
  milestones: (Pick<MilestoneRow, "kind" | "title" | "horizon" | "status" | "reason" | "optionalExploration"> & { refId: string | null })[];
  nextBestAction: NextBestAction | null;
  notes: Record<string, unknown>;
}

export interface VersionSummary {
  versionId: string;
  versionNo: number;
  generatedAt: string;
  trigger: RoadmapView["trigger"];
  readiness: number;
  careerName: string;
  isCurrentRoadmap: boolean;
}

type Row = Record<string, any>;

async function buildView(service: Service, version: Row, roadmap: Row, careerName: string, latestNo: number): Promise<RoadmapView> {
  const db = untyped(service);
  const id = version.id as string;
  const q = (table: string, order?: string) => db.from(table).select("*").eq("version_id", id).order(order ?? "version_id");
  const [goals, gaps, courses, learning, certs, projects, arena, milestones] = await Promise.all([
    q("roadmap_goals"), q("roadmap_skill_gaps", "sort_order"), q("roadmap_courses", "sort_order"), q("roadmap_learning_items"), q("roadmap_certifications"), q("roadmap_projects"), q("roadmap_arena_challenges"), q("roadmap_milestones", "sort_order"),
  ]);
  return {
    roadmapId: roadmap.id, versionId: id, versionNo: version.version_no, generatedAt: version.generated_at, trigger: version.trigger, mode: version.mode, isCurrent: roadmap.is_current, isLatest: version.version_no === latestNo,
    career: { id: roadmap.career_id, name: careerName }, readiness: version.readiness_score, baselineRecommended: version.baseline_recommended,
    goals: (goals.data ?? []).map((g: Row) => ({ kind: g.kind, careerId: g.career_id, careerName: g.career_name, readiness: g.readiness })),
    gaps: (gaps.data ?? []).map((g: Row) => ({ skillId: g.skill_id, skillName: g.skill_name, importance: g.importance, targetLevel: g.target_level, stage: g.stage, currentLevel: g.current_level, confidence: Number(g.confidence), verified: g.verified, selfDeclaredOnly: g.self_declared_only, gap: g.gap, coverage: g.coverage, gapType: g.gap_type, blockedBySkillId: g.blocked_by_skill_id })),
    subjects: (courses.data ?? []).map((c: Row) => ({ courseId: c.course_id, title: c.title, year: c.year, semester: c.semester, tier: c.tier, stars: c.stars, schedule: c.schedule, facts: c.facts, aiExplanation: c.ai_explanation })),
    learning: (learning.data ?? []).map((l: Row) => ({ skillName: l.skill_name, title: l.title, provider: l.provider, url: l.url, levelFrom: l.level_from, levelTo: l.level_to, estimatedHours: l.estimated_hours == null ? null : Number(l.estimated_hours), startsNow: l.starts_now, reason: l.reason })),
    certifications: (certs.data ?? []).map((c: Row) => ({ name: c.name, provider: c.provider, url: c.url, relevance: c.relevance })),
    projects: (projects.data ?? []).map((p: Row) => ({ title: p.title, difficulty: p.difficulty, isAiRecommendation: p.is_ai_recommendation, status: p.status })),
    arena: (arena.data ?? []).map((a: Row) => ({ challengeId: a.challenge_id, title: a.title, difficulty: a.difficulty })),
    milestones: (milestones.data ?? []).map((m: Row) => ({ kind: m.kind, title: m.title, horizon: m.horizon, status: m.status, reason: m.reason, optionalExploration: m.optional_exploration, refId: m.ref_id })),
    nextBestAction: version.next_best_action ?? null,
    notes: version.notes ?? {},
  };
}

async function careerName(service: Service, careerId: string): Promise<string> {
  const { data } = await service.from("careers").select("name").eq("id", careerId).maybeSingle();
  return data?.name ?? "Career";
}

/** One version of a roadmap the student OWNS (by version id); null for anyone else's or an unknown id. */
export async function getRoadmapVersionView(service: Service, studentId: string, versionId: string): Promise<RoadmapView | null> {
  const db = untyped(service);
  const { data: version } = await db.from("roadmap_versions").select("*").eq("id", versionId).maybeSingle();
  if (!version) return null;
  const { data: roadmap } = await db.from("roadmaps").select("*").eq("id", version.roadmap_id).eq("student_id", studentId).maybeSingle();
  if (!roadmap) return null;
  const { data: latest } = await db.from("roadmap_versions").select("version_no").eq("roadmap_id", roadmap.id).order("version_no", { ascending: false }).limit(1).single();
  return buildView(service, version, roadmap, await careerName(service, roadmap.career_id), latest?.version_no ?? version.version_no);
}

/** The newest version of the student's current roadmap, or null if they have none. */
export async function getCurrentRoadmapView(service: Service, studentId: string): Promise<RoadmapView | null> {
  const db = untyped(service);
  const { data: roadmap } = await db.from("roadmaps").select("*").eq("student_id", studentId).eq("is_current", true).maybeSingle();
  if (!roadmap) return null;
  const { data: version } = await db.from("roadmap_versions").select("*").eq("roadmap_id", roadmap.id).order("version_no", { ascending: false }).limit(1).maybeSingle();
  return version ? buildView(service, version, roadmap, await careerName(service, roadmap.career_id), version.version_no) : null;
}

/** Every version of every roadmap the student has had, newest first — old versions are never deleted. */
export async function listRoadmapVersions(service: Service, studentId: string): Promise<VersionSummary[]> {
  const db = untyped(service);
  const { data: roadmaps } = await db.from("roadmaps").select("id, career_id, is_current").eq("student_id", studentId);
  if (!roadmaps?.length) return [];
  const { data: versions } = await db.from("roadmap_versions").select("id, roadmap_id, version_no, generated_at, trigger, readiness_score").in("roadmap_id", roadmaps.map((r: Row) => r.id)).order("generated_at", { ascending: false });
  const names = new Map<string, string>();
  for (const r of roadmaps as Row[]) names.set(r.id, await careerName(service, r.career_id));
  const current = new Map((roadmaps as Row[]).map((r) => [r.id, r.is_current as boolean]));
  return ((versions ?? []) as Row[]).map((v) => ({ versionId: v.id, versionNo: v.version_no, generatedAt: v.generated_at, trigger: v.trigger, readiness: v.readiness_score, careerName: names.get(v.roadmap_id) ?? "Career", isCurrentRoadmap: current.get(v.roadmap_id) ?? false }));
}
