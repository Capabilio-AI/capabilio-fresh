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

/** The name of the role the student chose, or null when they have not chosen one. */
export async function chosenRoleName(db: SupabaseClient<Database>, userId: string): Promise<string | null> {
  const { data: intent } = await db.from("student_career_intent").select("primary_career_id").eq("student_id", userId).maybeSingle();
  if (!intent?.primary_career_id) return null;
  const { data: career } = await db.from("careers").select("name").eq("id", intent.primary_career_id).maybeSingle();
  return career?.name ?? null;
}
