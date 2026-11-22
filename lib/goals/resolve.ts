import type { SupabaseClient } from "@supabase/supabase-js";
import { untyped } from "@/lib/org/db";
import { suggestCareersForGoal } from "@/lib/roadmap/suggest";
import { listPublishedForMatching } from "@/lib/pathways/store";
import { goalKey, matchPathways, type PathwayMatch } from "./match";

type Service = SupabaseClient;

export const MIN_CAREER_CONFIDENCE = 0.5;
export interface CareerHit { key: string; name: string; confidence: number }
/** "unavailable": the job-role check could not run and no pathway matched, so nothing can be said (and nothing is recorded) */
export type GoalOutcome = "career" | "pathway" | "both" | "none" | "unavailable";
export interface GoalResolution { outcome: GoalOutcome; careers: CareerHit[]; pathways: PathwayMatch[]; recorded: boolean }

export interface Deps {
  suggestCareers?: typeof suggestCareersForGoal;
  pathways?: typeof listPublishedForMatching;
}

/**
 * Resolves what a student typed. A published pathway is matched by name and alias (never guessed); a job role is matched by the existing careers matcher,
 * kept only above MIN_CAREER_CONFIDENCE. When neither covers it, the goal is recorded as a request, once per student and goal, so the next pathway
 * written is the one students ask for. A failure of the careers matcher never hides a pathway match, and a pathway match never hides a job role.
 */
export async function resolveGoal(service: Service, userId: string, text: string, deps: Deps = {}): Promise<GoalResolution> {
  const suggest = deps.suggestCareers ?? suggestCareersForGoal;
  const listPathways = deps.pathways ?? listPublishedForMatching;

  const [pathwayRows, careerRows] = await Promise.all([
    listPathways(service),
    service.from("careers").select("key, name, description").eq("is_active", true).then((r) => r.data ?? []),
  ]);
  const pathways = matchPathways(text, pathwayRows);

  let careers: CareerHit[] = [];
  let careersChecked = true;
  try {
    const hits = await suggest(text, careerRows.map((c: { key: string; name: string; description: string | null }) => ({ key: c.key, name: c.name, description: c.description })));
    const names = new Map(careerRows.map((c: { key: string; name: string }) => [c.key, c.name]));
    careers = hits.filter((h) => h.confidence >= MIN_CAREER_CONFIDENCE && names.has(h.key)).map((h) => ({ key: h.key, name: names.get(h.key) as string, confidence: h.confidence }));
  } catch (e) {
    // the careers matcher is a model call; if it is down a pathway match still stands, but an unmatched goal is NOT recorded as a gap, because it may well be a job role
    careersChecked = false;
    console.error("[goals] career matching failed:", e instanceof Error ? e.message : e);
  }

  const outcome: GoalOutcome = careers.length > 0 && pathways.length > 0 ? "both" : careers.length > 0 ? "career" : pathways.length > 0 ? "pathway" : careersChecked ? "none" : "unavailable";
  let recorded = false;
  if (outcome === "none") {
    const key = goalKey(text);
    if (key) {
      const { error } = await untyped(service).from("goal_requests").upsert({ user_id: userId, goal_text: text.slice(0, 300), goal_key: key }, { onConflict: "user_id,goal_key", ignoreDuplicates: true });
      recorded = !error;
      if (error) console.error("[goals] could not record the goal:", error.message);
    }
  }
  return { outcome, careers, pathways, recorded };
}
