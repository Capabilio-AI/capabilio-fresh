import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

/**
 * Whether the student has chosen a role. Everything that is about a role (recommendation, skill graph, passport, roadmap, readiness)
 * exists only when they have; a student who skipped the role sees their assessment and nothing invented in its place.
 */
export async function studentHasRole(db: SupabaseClient<Database>, userId: string): Promise<boolean> {
  const { data } = await db.from("student_career_intent").select("primary_career_id").eq("student_id", userId).maybeSingle();
  return !!data?.primary_career_id;
}
