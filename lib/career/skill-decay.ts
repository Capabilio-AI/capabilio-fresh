import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export type DecayState = "fresh" | "aging" | "at_risk" | "decayed" | "not_practiced";

export const DECAY_LABEL: Record<DecayState, string> = {
  fresh: "Practiced recently",
  aging: "Getting stale",
  at_risk: "At risk — practice soon",
  decayed: "Decayed — needs a refresh",
  not_practiced: "Not yet practiced in Arena",
};

export interface SkillPracticeRecency {
  decayState: DecayState;
  daysSincePractice: number | null;
}

function decayStateForDays(days: number): Exclude<DecayState, "not_practiced"> {
  if (days <= 7) return "fresh";
  if (days <= 14) return "aging";
  if (days <= 30) return "at_risk";
  return "decayed";
}

/**
 * Real Arena-practice recency per skill. Only Arena challenge completions
 * count as "practice" here — a deliberate active-recall signal, distinct
 * from the one-time initial diagnostic assessment. A skill never practiced
 * in Arena is honestly "not_practiced" (daysSincePractice: null), never
 * defaulted into a fabricated freshness state — matches capabilio's rule
 * that a measurement that never happened must never be stood in for.
 */
export async function getSkillPracticeRecency(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<Map<string, SkillPracticeRecency>> {
  const { data } = await supabase
    .from("capability_history")
    .select("skill, recorded_at")
    .eq("user_id", userId)
    .eq("source", "arena_challenge")
    .order("recorded_at", { ascending: false });

  const latestBySkill = new Map<string, string>();
  for (const row of data ?? []) {
    if (!latestBySkill.has(row.skill)) latestBySkill.set(row.skill, row.recorded_at);
  }

  const result = new Map<string, SkillPracticeRecency>();
  for (const [skill, recordedAt] of latestBySkill) {
    const daysSince = Math.max(1, Math.floor((Date.now() - new Date(recordedAt).getTime()) / (1000 * 60 * 60 * 24)));
    result.set(skill, { decayState: decayStateForDays(daysSince), daysSincePractice: daysSince });
  }
  return result;
}
