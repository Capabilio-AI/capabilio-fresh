import type { SupabaseClient } from "@supabase/supabase-js";
import { ONBOARDING_STATUSES, type OnboardingStatus } from "./config";
import type { Target } from "./engine";
import type { RoleSkill } from "./scoring";

// The new tables postdate lib/supabase/types.ts, so they are reached through an untyped client (same approach as lib/org/db).
export type Db = SupabaseClient;

export interface CareerRef {
  id: string;
  key: string;
  name: string;
}

// The taxonomy changes rarely (an admin edit), but it is read on every question. A short per-process cache keeps a question
// from costing two extra round trips; an edit shows up within TTL_MS.
const TTL_MS = 60_000;
const cache = new Map<string, { at: number; value: unknown }>();
async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value as T;
  const value = await load();
  cache.set(key, { at: Date.now(), value });
  return value;
}

export function loadCareer(db: Db, careerId: string): Promise<CareerRef | null> {
  return cached(`career:${careerId}`, async () => (await db.from("careers").select("id, key, name").eq("id", careerId).eq("is_active", true).maybeSingle()).data ?? null);
}

export interface CareerSkillRow extends RoleSkill {
  description: string | null;
  min: number;
  max: number;
}

/** The role's complete canonical skill set, straight from the taxonomy tables. The frontend never hardcodes skills. */
export function loadCareerSkills(db: Db, careerId: string): Promise<CareerSkillRow[]> {
  return cached(`skills:${careerId}`, () => queryCareerSkills(db, careerId));
}

async function queryCareerSkills(db: Db, careerId: string): Promise<CareerSkillRow[]> {
  const { data, error } = await db
    .from("career_skill_requirements")
    .select("skill_id, importance, target_level, assessment_weight, min_questions, max_questions, skills!inner(key, name, category, description, status)")
    .eq("career_id", careerId);
  if (error) throw error;
  type Row = {
    skill_id: string; importance: RoleSkill["importance"]; target_level: number; assessment_weight: number; min_questions: number; max_questions: number;
    skills: { key: string; name: string; category: string | null; description: string | null; status: string };
  };
  return ((data ?? []) as unknown as Row[])
    .filter((r) => r.skills.status === "active")
    .map((r) => ({
      skillId: r.skill_id, key: r.skills.key, name: r.skills.name, category: r.skills.category, description: r.skills.description,
      importance: r.importance, targetLevel: r.target_level, weight: Number(r.assessment_weight), min: r.min_questions, max: r.max_questions,
    }))
    .sort((a, b) => b.weight - a.weight || a.name.localeCompare(b.name));
}

export const toTargets = (skills: readonly CareerSkillRow[]): Target[] =>
  skills.map((s) => ({ id: s.skillId, name: s.name, weight: s.weight, min: s.min, max: s.max }));

// ------------------------------------------------------------------------------------------------------------------
// onboarding gate
// ------------------------------------------------------------------------------------------------------------------
const rank = (s: OnboardingStatus) => ONBOARDING_STATUSES.indexOf(s);

export async function getOnboardingStatus(db: Db, userId: string): Promise<OnboardingStatus> {
  const { data } = await db.from("student_onboarding").select("status").eq("student_id", userId).maybeSingle();
  if (data) return data.status as OnboardingStatus;
  // first sight of this student: they start gated (existing students were backfilled by migration 080)
  await db.from("student_onboarding").upsert({ student_id: userId, status: "ASSESSMENT_REQUIRED" }, { onConflict: "student_id", ignoreDuplicates: true });
  return "ASSESSMENT_REQUIRED";
}

/** Only ever moves forward: finishing the general assessment again must not demote a student who is already ACTIVE. */
export async function advanceOnboarding(db: Db, userId: string, to: OnboardingStatus): Promise<OnboardingStatus> {
  const current = await getOnboardingStatus(db, userId);
  if (rank(to) <= rank(current)) return current;
  await db.from("student_onboarding").update({ status: to, updated_at: new Date().toISOString() }).eq("student_id", userId);
  return to;
}

/** Starting rating for every role, read from the rules table so it is configuration, not code. */
export function startRating(db: Db): Promise<number> {
  return cached("elo:start", async () => (await db.from("elo_rules").select("start_rating").eq("source", "ASSESSMENT").maybeSingle()).data?.start_rating ?? 400);
}

export const dashboardUnlocked = (s: OnboardingStatus) => s === "PROFILE_READY";

// ------------------------------------------------------------------------------------------------------------------
// analytics
// ------------------------------------------------------------------------------------------------------------------
export const EVENT_NAMES = [
  "assessment_banner_shown", "assessment_started", "career_role_entered", "career_role_confirmed", "common_section_started",
  "common_section_completed", "common_question_answered", "career_assessment_started", "career_question_answered",
  "career_assessment_completed", "skill_estimated", "elo_updated", "feedback_generated", "assessment_popup_viewed",
  "dashboard_opened_after_assessment", "proof_of_work_added", "career_goal_selected", "career_goal_changed",
] as const;
export type EventName = (typeof EVENT_NAMES)[number];

/** Events the browser may report itself (everything else is emitted by the server at the moment it happens). */
export const CLIENT_EVENTS: readonly EventName[] = ["assessment_banner_shown", "assessment_popup_viewed", "dashboard_opened_after_assessment"];

/** Best-effort: analytics must never fail the request it describes. */
export async function track(db: Db, userId: string | null, name: EventName, props: Record<string, unknown> = {}): Promise<void> {
  const { error } = await db.from("product_events").insert({ user_id: userId, name, props });
  if (error) console.error("[assess] analytics insert failed:", name, error.message);
}
