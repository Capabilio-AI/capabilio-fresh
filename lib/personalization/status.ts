import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { loadCareerSkills, type Db } from "@/lib/assess/db";
import { careerSessionLength } from "@/lib/assess/session";
import { getCareerIntent } from "@/lib/careers/intent";
import { chooseDomainCareer } from "@/lib/arena-challenges/career-state";
import { roadmapState, type RoadmapState } from "@/lib/roadmap-generate/runs";
import { getRoleTaskAvailability, type RoleTaskAvailability } from "@/lib/arena-workstations/availability";

/**
 * What the student sees for each piece of personalization. Every state is read from backend state (the question pool, the roadmap generation
 * run, the workstation registry), never invented: "idle" means nothing has started yet, "retry" means the last attempt failed.
 */
export type PartState = "ready" | "preparing" | "idle" | "retry" | "unavailable";
export interface PartStatus {
  key: "assessment" | "pathway" | "arena";
  label: string;
  state: PartState;
}
export interface PersonalizationStatus {
  career: { id: string; name: string } | null;
  parts: PartStatus[];
  /** nothing is still being prepared, so the client can stop polling */
  settled: boolean;
}

export function assessmentPart(questionsInPool: number, questionsNeeded: number): PartStatus {
  return questionsInPool >= questionsNeeded
    ? { key: "assessment", label: "Your assessment questions are ready", state: "ready" }
    : { key: "assessment", label: "Preparing your assessment questions", state: "preparing" };
}

/** SkillStudio's modules and the Career Map are both read from the career's roadmap, so they share one honest state. */
export function pathwayPart(state: RoadmapState): PartStatus {
  switch (state) {
    case "READY": return { key: "pathway", label: "Your learning pathway and Career Map are ready", state: "ready" };
    case "RUNNING": return { key: "pathway", label: "Preparing your learning pathway and Career Map", state: "preparing" };
    case "FAILED": return { key: "pathway", label: "Your learning pathway is temporarily unavailable", state: "retry" };
    default: return { key: "pathway", label: "Your learning pathway has not started yet", state: "idle" };
  }
}

/** "building" is a settled, truthful state: the role has no hands-on tasks yet. It is not an error and nothing else is substituted. */
export function arenaPart(availability: RoleTaskAvailability, careerName: string): PartStatus | null {
  if (availability.state === "ready") return { key: "arena", label: `Arena practice for ${careerName} is ready`, state: "ready" };
  if (availability.state === "building") return { key: "arena", label: `Arena practice for ${careerName} is being developed`, state: "unavailable" };
  return null;
}

export const isSettled = (parts: readonly PartStatus[]) => parts.every((p) => p.state !== "preparing");

export async function loadPersonalizationStatus(service: SupabaseClient<Database>, userId: string, isStudent: boolean): Promise<PersonalizationStatus> {
  const { intent } = await getCareerIntent(service, userId);
  const chosen = chooseDomainCareer(intent, "primary");
  if (chosen.state !== "ready") return { career: null, parts: [], settled: true };
  const { id, name } = chosen.career;

  const db = service as unknown as Db;
  const [skills, pool, roadmap, arena] = await Promise.all([
    loadCareerSkills(db, id),
    db.from("assess_question_pool").select("id", { count: "exact", head: true }).eq("layer", "CAREER").eq("career_id", id).eq("is_active", true),
    roadmapState(service, id),
    getRoleTaskAvailability(service, userId, isStudent).catch((): RoleTaskAvailability => ({ state: "unknown" })),
  ]);
  const parts = [assessmentPart(pool.count ?? 0, careerSessionLength(skills)), pathwayPart(roadmap.state), arenaPart(arena, name)].filter((p): p is PartStatus => p !== null);
  return { career: { id, name }, parts, settled: isSettled(parts) };
}
