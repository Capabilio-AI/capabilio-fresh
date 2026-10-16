import type { SupabaseClient } from "@supabase/supabase-js";
import { untyped } from "@/lib/org/db";
import { getStageState } from "@/lib/stage/server";
import { experienceLevel, type ExperienceLevel } from "./level";

/** The user's experience from their career stage and recorded jobs. Never throws: with nothing to go on they are treated as a fresher. */
export async function loadExperienceLevel(service: SupabaseClient<never> | SupabaseClient, userId: string): Promise<ExperienceLevel> {
  try {
    const { stage } = await getStageState(userId);
    if (stage !== "professional") return "fresher";
    const db = untyped(service as SupabaseClient<never>);
    const [{ data: jobs }, { data: profile }] = await Promise.all([
      db.from("employment_history").select("start_date").eq("user_id", userId),
      db.from("profiles").select("employed_since").eq("id", userId).maybeSingle(),
    ]);
    const startDates = [...((jobs ?? []) as { start_date: string | null }[]).map((j) => j.start_date), (profile as { employed_since: string | null } | null)?.employed_since ?? null];
    return experienceLevel({ stage, startDates });
  } catch {
    return "fresher";
  }
}
