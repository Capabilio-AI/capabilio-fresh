import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { GOAL_KEYS, type GoalKey } from "./insights";

export interface CareerIntentRow {
  userId: string;
  name: string;
  branch: string | null;
  endYear: number | null;
  goal: GoalKey;
}

export interface CareerIntentFilters {
  goal?: GoalKey;
  branch?: string;
  endYear?: number;
}

const MAX_ROWS = 1000;

export const isGoalKey = (v: string | undefined): v is GoalKey => !!v && (GOAL_KEYS as readonly string[]).includes(v);

const toGoal = (g: string | null): GoalKey => (g === "job" || g === "higher_studies" || g === "entrepreneur" || g === "not_sure" ? g : "unset");

/** Pure. Counts per intent over the given rows (every key present, zeros included). */
export function countByGoal(rows: Pick<CareerIntentRow, "goal">[]): Record<GoalKey, number> {
  const counts = { job: 0, higher_studies: 0, entrepreneur: 0, not_sure: 0, unset: 0 } as Record<GoalKey, number>;
  for (const r of rows) counts[r.goal] += 1;
  return counts;
}

/**
 * Named career intent for the college's own active students — for TPO / admin, so they can invite companies
 * and put only placement-focused students in front of them. Counts cover the branch/year filter; the goal
 * filter only narrows the list. Institution-scoped; never shown to companies.
 */
export async function loadCareerIntent(service: SupabaseClient<Database>, institutionId: string, filters: CareerIntentFilters) {
  const { data } = await service
    .from("institution_memberships")
    .select("user_id, branch, end_year, goal_state")
    .eq("institution_id", institutionId)
    .eq("role", "student")
    .eq("status", "active")
    .limit(MAX_ROWS + 1);
  const all = (data ?? []).slice(0, MAX_ROWS);
  const truncated = (data ?? []).length > MAX_ROWS;

  const branches = [...new Set(all.map((m) => m.branch).filter((b): b is string => Boolean(b)))].sort();
  const years = [...new Set(all.map((m) => m.end_year).filter((y): y is number => y !== null))].sort((a, b) => b - a);

  const inCohort = all.filter(
    (m) => (!filters.branch || (m.branch ?? "").toLowerCase() === filters.branch.toLowerCase()) && (!filters.endYear || m.end_year === filters.endYear)
  );
  const counts = countByGoal(inCohort.map((m) => ({ goal: toGoal(m.goal_state) })));
  const listed = inCohort.filter((m) => !filters.goal || toGoal(m.goal_state) === filters.goal);

  const ids = listed.map((m) => m.user_id);
  const { data: profiles } = ids.length ? await service.from("profiles").select("id, full_name, email").in("id", ids) : { data: [] };
  const names = new Map((profiles ?? []).map((p) => [p.id, p.full_name ?? p.email]));

  const rows = listed
    .map((m): CareerIntentRow => ({ userId: m.user_id, name: names.get(m.user_id) ?? "Student", branch: m.branch, endYear: m.end_year, goal: toGoal(m.goal_state) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return { rows, counts, total: inCohort.length, branches, years, truncated };
}
