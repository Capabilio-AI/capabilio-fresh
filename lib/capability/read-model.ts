/**
 * What a student can demonstrably do, per CANONICAL skill — a read model over the existing capability data, not a second copy of it.
 * `capabilities.capability_score` (0–100) stays the source of truth where it exists; Arena-only skills get an explicit, documented
 * count → level formula; and VERIFIED evidence is tracked separately from SELF_DECLARED (capped, lower confidence, never outweighing verified).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { loadSkillIndex } from "@/lib/skills/store";
import { resolveSkill } from "@/lib/skills/resolve";

export type EvidenceKind = "ASSESSMENT" | "ARENA" | "PROJECT" | "COURSE_PERFORMANCE" | "CERTIFICATION" | "MENTOR_EVALUATION" | "GITHUB" | "LEARNING_MODULE" | "SELF_DECLARED";
export interface EvidenceItem {
  skillId: string;
  kind: EvidenceKind;
  /** 0–100 */
  level: number;
  /** 0–1 */
  confidence: number;
}
export interface SkillCapability {
  skillId: string;
  /** what the student can be shown to have: verified level if any, else the capped self-declared level */
  level: number;
  confidence: number;
  verified: boolean;
  verifiedLevel: number | null;
  selfDeclaredLevel: number | null;
  /** how many evidence items of each kind back this skill */
  breakdown: Partial<Record<EvidenceKind, number>>;
}

/** Arena: each verified task is worth 25 points of level, so 4 verified tasks = 100. */
export const ARENA_LEVEL_PER_VERIFIED = 25;
/** A self-declared skill can never show above this, and carries no confidence of its own. */
export const SELF_DECLARED_MAX_LEVEL = 40;
/** capabilities.confidence (low/medium/high) as a number. */
export const CONFIDENCE_VALUE = { low: 0.4, medium: 0.7, high: 0.9 } as const;

export const arenaLevel = (verifiedCount: number): number => Math.min(100, Math.max(0, verifiedCount) * ARENA_LEVEL_PER_VERIFIED);
export const arenaConfidence = (verifiedCount: number): number => (verifiedCount >= 3 ? 0.9 : verifiedCount === 2 ? 0.7 : verifiedCount === 1 ? 0.5 : 0);

export function kindOfSource(source: string | undefined): EvidenceKind {
  switch (source) {
    case "arena_challenge": return "ARENA";
    case "project": return "PROJECT";
    case "github_repository": return "GITHUB";
    case "learning_module": return "LEARNING_MODULE";
    default: return "ASSESSMENT"; // initial_assessment, reassessment, or unknown
  }
}

const clamp = (n: number) => Math.min(100, Math.max(0, n));

export function combineEvidence(items: EvidenceItem[]): Map<string, SkillCapability> {
  const out = new Map<string, SkillCapability>();
  const bySkill = new Map<string, EvidenceItem[]>();
  for (const i of items) bySkill.set(i.skillId, [...(bySkill.get(i.skillId) ?? []), i]);
  for (const [skillId, list] of bySkill) {
    const verified = list.filter((i) => i.kind !== "SELF_DECLARED");
    const self = list.filter((i) => i.kind === "SELF_DECLARED");
    const verifiedLevel = verified.length ? Math.max(...verified.map((i) => clamp(i.level))) : null;
    const selfDeclaredLevel = self.length ? Math.min(SELF_DECLARED_MAX_LEVEL, Math.max(...self.map((i) => clamp(i.level)))) : null;
    const breakdown: Partial<Record<EvidenceKind, number>> = {};
    for (const i of list) breakdown[i.kind] = (breakdown[i.kind] ?? 0) + 1;
    out.set(skillId, {
      skillId,
      level: verifiedLevel ?? selfDeclaredLevel ?? 0,
      confidence: verified.length ? Math.max(...verified.map((i) => i.confidence)) : 0,
      verified: verifiedLevel !== null,
      verifiedLevel,
      selfDeclaredLevel,
      breakdown,
    });
  }
  return out;
}

export interface StudentCapabilities {
  bySkill: Map<string, SkillCapability>;
  /** capability records whose skill name did not resolve to the canonical catalog (not counted, listed so the gap is visible) */
  unmatched: string[];
}

/**
 * Reads the student's existing capability rows and Arena ratings and expresses them per canonical skill. Reads only (service role,
 * after the caller is known). The `evidence` table is not read separately: it already feeds `capabilities`, so adding it would double count.
 */
export async function loadStudentCapabilities(service: SupabaseClient<Database>, userId: string): Promise<StudentCapabilities> {
  const index = await loadSkillIndex(service);
  const [{ data: caps }, { data: history }, { data: ratings }, { data: areas }] = await Promise.all([
    service.from("capabilities").select("skill, capability_score, confidence").eq("user_id", userId),
    service.from("capability_history").select("skill, source, recorded_at").eq("user_id", userId).order("recorded_at", { ascending: false }),
    service.from("arena_skill_ratings").select("role_key, area_key, verified_count").eq("user_id", userId),
    service.from("arena_skill_areas").select("role_key, area_key, skill_id").not("skill_id", "is", null),
  ]);

  const latestSource = new Map<string, string>();
  for (const h of history ?? []) if (!latestSource.has(h.skill)) latestSource.set(h.skill, h.source);

  const items: EvidenceItem[] = [];
  const unmatched: string[] = [];
  for (const c of caps ?? []) {
    const hit = resolveSkill(c.skill, index);
    if (!hit) { unmatched.push(c.skill); continue; }
    items.push({ skillId: hit.skillId, kind: kindOfSource(latestSource.get(c.skill)), level: c.capability_score, confidence: CONFIDENCE_VALUE[c.confidence] });
  }
  for (const r of ratings ?? []) {
    const skillId = (areas ?? []).find((a) => a.role_key === r.role_key && a.area_key === r.area_key)?.skill_id;
    if (!skillId || r.verified_count <= 0) continue;
    items.push({ skillId, kind: "ARENA", level: arenaLevel(r.verified_count), confidence: arenaConfidence(r.verified_count) });
  }
  return { bySkill: combineEvidence(items), unmatched };
}
