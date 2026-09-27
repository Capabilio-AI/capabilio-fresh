import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

/** The student's own free-text career interest, verbatim (career_interest_target.stated_role) — captured once, before the Career Interests assessment section generates. */
export async function getStatedCareerInterest(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("career_interest_target")
    .select("stated_role")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.stated_role ?? null;
}
