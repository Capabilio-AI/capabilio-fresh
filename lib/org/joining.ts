import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export interface JoiningYear { year: number; joined: number }

/** Counts of students per year they joined, oldest first, with every year in the span present (0 when nobody joined). Pure. */
export function joiningByYear(joinedAt: readonly string[], lastYears = 6): JoiningYear[] {
  const years = joinedAt.map((d) => new Date(d).getFullYear()).filter((y) => Number.isFinite(y));
  if (years.length === 0) return [];
  const last = Math.max(...years);
  const first = Math.max(Math.min(...years), last - (lastYears - 1));
  return Array.from({ length: last - first + 1 }, (_, i) => first + i).map((year) => ({ year, joined: years.filter((y) => y === year).length }));
}

/** Everyone who joined this college as a student, whether they are still here or not: the trend is about intake, not who is current. */
export async function loadJoiningTrend(service: SupabaseClient<Database>, institutionId: string): Promise<JoiningYear[]> {
  const { data } = await service.from("institution_memberships").select("created_at").eq("institution_id", institutionId).eq("role", "student").in("status", ["active", "revoked"]).limit(20000);
  return joiningByYear((data ?? []).map((r) => r.created_at));
}
