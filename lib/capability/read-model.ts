/**
 * What a student can demonstrably do, per CANONICAL skill: a read model over the existing capability, evidence and Arena data, not a second copy of it.
 * Scoring is capability.v2 (lib/roadmap-visual/capability.ts): evidence is weighted by verification, recency and difficulty; no evidence means a NULL level
 * (never 0, never "verified"); every score keeps the list of evidence behind it so it can be explained.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { untyped } from "@/lib/org/db";
import { loadSkillIndex } from "@/lib/skills/store";
import { resolveSkill } from "@/lib/skills/resolve";
import { scoreSkill, type Difficulty, type EvidenceInput, type SkillScore } from "@/lib/roadmap-visual/capability";

export type EvidenceKind = "ASSESSMENT" | "ARENA" | "PROJECT" | "COURSE_PERFORMANCE" | "CERTIFICATION" | "MENTOR_EVALUATION" | "GITHUB" | "LEARNING_MODULE" | "SELF_DECLARED";
export interface SkillCapability extends Pick<SkillScore, "confidence" | "verified" | "verifiedLevel" | "selfDeclaredLevel" | "breakdown" | "lines" | "formula" | "evidenceCount"> {
  skillId: string;
  /** null = not assessed: nothing has been measured. Never 0 for "unknown". */
  level: number | null;
}

/** Arena: each verified task is worth 25 points of level, so 4 verified tasks = 100. */
export const ARENA_LEVEL_PER_VERIFIED = 25;
/** A self-declared skill can never show above this, and carries no confidence of its own. */
export const SELF_DECLARED_MAX_LEVEL = 40;
/** capabilities.confidence (low/medium/high) as a number. */
export const CONFIDENCE_VALUE = { low: 0.4, medium: 0.7, high: 0.9 } as const;

export const arenaLevel = (verifiedCount: number): number => Math.min(100, Math.max(0, verifiedCount) * ARENA_LEVEL_PER_VERIFIED);
export const arenaConfidence = (verifiedCount: number): number => (verifiedCount >= 3 ? 0.9 : verifiedCount === 2 ? 0.7 : verifiedCount === 1 ? 0.5 : 0);

export function kindOfSource(source: string | null | undefined): EvidenceKind {
  switch (source) {
    case "arena_challenge": return "ARENA";
    case "project": return "PROJECT";
    case "github_repository": return "GITHUB";
    case "learning_module": return "LEARNING_MODULE";
    default: return "ASSESSMENT"; // initial_assessment, reassessment, or unknown
  }
}

/** Pure. Scores each skill from its evidence (capability.v2). A skill with no evidence is simply absent. */
export function combineEvidence(items: (EvidenceInput & { skillId: string })[], now: Date = new Date()): Map<string, SkillCapability> {
  const bySkill = new Map<string, (EvidenceInput & { skillId: string })[]>();
  for (const i of items) bySkill.set(i.skillId, [...(bySkill.get(i.skillId) ?? []), i]);
  const out = new Map<string, SkillCapability>();
  for (const [skillId, list] of bySkill) {
    const { level, confidence, verified, verifiedLevel, selfDeclaredLevel, breakdown, lines, formula, evidenceCount } = scoreSkill(list, now);
    out.set(skillId, { skillId, level, confidence, verified, verifiedLevel, selfDeclaredLevel, breakdown, lines, formula, evidenceCount });
  }
  return out;
}

export interface StudentCapabilities {
  bySkill: Map<string, SkillCapability>;
  /** the evidence each score was computed from, so callers can ask "what if" questions */
  inputs: Map<string, EvidenceInput[]>;
  /** capability records whose skill name did not resolve to the canonical catalog (not counted, listed so the gap is visible) */
  unmatched: string[];
}

const SOURCE_LABEL: Record<EvidenceKind, string> = {
  ASSESSMENT: "Capabilio assessment", ARENA: "Arena", PROJECT: "Project", COURSE_PERFORMANCE: "Course performance", CERTIFICATION: "Certification",
  MENTOR_EVALUATION: "Mentor evaluation", GITHUB: "GitHub", LEARNING_MODULE: "Learning module", SELF_DECLARED: "Self-declared",
};

/**
 * Reads the student's capability rows, per-attempt Arena evidence and Arena ratings and expresses them per canonical skill (capability.v2).
 * Arena passes come from the `evidence` table (one dated row per pass); a rating that records more verified passes than evidence rows (older data)
 * contributes the difference, dated at its last verification, so nothing is lost and nothing is counted twice. Reads only.
 */
export async function loadStudentCapabilities(service: SupabaseClient<Database>, userId: string, now: Date = new Date()): Promise<StudentCapabilities> {
  const db = untyped(service);
  const index = await loadSkillIndex(service);
  const [{ data: caps }, { data: history }, { data: ratings }, { data: areas }, { data: skillElo }, { data: arenaEvidence }] = await Promise.all([
    service.from("capabilities").select("skill, capability_score, confidence").eq("user_id", userId),
    service.from("capability_history").select("skill, source, recorded_at").eq("user_id", userId).order("recorded_at", { ascending: false }),
    db.from("arena_skill_ratings").select("role_key, area_key, verified_count, last_verified_at").eq("user_id", userId),
    service.from("arena_skill_areas").select("role_key, area_key, skill_id").not("skill_id", "is", null),
    db.from("arena_skill_elo").select("skill_id, verified_count, last_verified_at").eq("student_id", userId),
    db.from("evidence").select("skill, observed_at, source_identifier, metadata").eq("user_id", userId).eq("source_type", "arena_challenge").eq("evidence_type", "arena_result"),
  ]);

  const latest = new Map<string, { source: string; at: string }>();
  for (const h of history ?? []) if (!latest.has(h.skill)) latest.set(h.skill, { source: h.source, at: h.recorded_at });

  const items: (EvidenceInput & { skillId: string })[] = [];
  const unmatched: string[] = [];
  for (const c of caps ?? []) {
    const hit = resolveSkill(c.skill, index);
    if (!hit) { unmatched.push(c.skill); continue; }
    const seen = latest.get(c.skill);
    const kind = kindOfSource(seen?.source);
    items.push({ skillId: hit.skillId, kind, level: c.capability_score, rawScore: c.capability_score, observedAt: seen ? new Date(seen.at) : null, label: SOURCE_LABEL[kind] });
  }

  // Arena passes, one item each, with the challenge's difficulty when we can find it.
  type ArenaRow = { skill: string; observed_at: string | null; metadata: { challengeId?: string; title?: string; score?: number; attemptId?: string } | null };
  const passes = ((arenaEvidence ?? []) as ArenaRow[]).flatMap((e) => {
    const hit = resolveSkill(e.skill, index);
    return hit ? [{ skillId: hit.skillId, row: e }] : [];
  });
  const challengeIds = [...new Set(passes.map((p) => p.row.metadata?.challengeId).filter((id): id is string => Boolean(id)))];
  const { data: difficulties } = challengeIds.length ? await db.from("arena_challenges").select("id, difficulty").in("id", challengeIds) : { data: [] };
  const difficultyOf = new Map<string, Difficulty>(((difficulties ?? []) as { id: string; difficulty: Difficulty }[]).map((d) => [d.id, d.difficulty]));
  const passCount = new Map<string, number>();
  for (const { skillId, row } of passes) {
    passCount.set(skillId, (passCount.get(skillId) ?? 0) + 1);
    const m = row.metadata;
    items.push({
      skillId, kind: "ARENA", level: null, observedAt: row.observed_at ? new Date(row.observed_at) : null, difficulty: m?.challengeId ? difficultyOf.get(m.challengeId) ?? null : null,
      label: m?.title ? `Arena: ${m.title}` : "Arena challenge", rawScore: typeof m?.score === "number" ? m.score : null, link: m?.attemptId ? `/arena/attempts/${m.attemptId}` : null,
    });
  }
  const recorded = new Map<string, { count: number; at: string | null }>();
  const addRecorded = (skillId: string | null | undefined, count: number, at: string | null) => {
    if (!skillId || count <= 0) return;
    const cur = recorded.get(skillId);
    recorded.set(skillId, { count: (cur?.count ?? 0) + count, at: [cur?.at ?? null, at].filter(Boolean).sort().at(-1) ?? null });
  };
  for (const r of (ratings ?? []) as { role_key: string; area_key: string; verified_count: number; last_verified_at: string | null }[]) addRecorded((areas ?? []).find((a) => a.role_key === r.role_key && a.area_key === r.area_key)?.skill_id, r.verified_count, r.last_verified_at);
  for (const e of (skillElo ?? []) as { skill_id: string; verified_count: number; last_verified_at: string | null }[]) addRecorded(e.skill_id, e.verified_count, e.last_verified_at);
  for (const [skillId, r] of recorded) {
    for (let i = (passCount.get(skillId) ?? 0); i < r.count; i++) items.push({ skillId, kind: "ARENA", level: null, observedAt: r.at ? new Date(r.at) : null, label: "Arena challenge (earlier record)" });
  }
  const inputs = new Map<string, EvidenceInput[]>();
  for (const i of items) inputs.set(i.skillId, [...(inputs.get(i.skillId) ?? []), i]);
  return { bySkill: combineEvidence(items, now), inputs, unmatched };
}
