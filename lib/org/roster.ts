import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { OrgContext } from "./context";
import { untyped } from "./db";

export interface RosterRow {
  userId: string;
  name: string;
  branch: string | null;
  endYear: number | null;
  rollNumber: string | null;
  /** unchecked: no college code yet; verified: roll number starts with it; flagged: missing or different */
  rollStatus: "unchecked" | "verified" | "flagged";
  /** project groups the student belongs to */
  groups: number;
  /** projects graded by staff (each is one staff-verified evidence record) */
  gradedProjects: number;
  /** Arena challenges completed in the last 30 days */
  arenaLast30: number;
}

export interface RosterFilters {
  branch?: string;
  endYear?: number;
}

const MAX_ROWS = 500;
const DAY = 86_400_000;

/**
 * A college's own students, for the staff who teach them and for admins. Real counts only — no rating is
 * shown (Arena ratings belong to the student's own Portfolio). Faculty whose membership names a branch see
 * that branch by default scope; admins and unscoped staff see the whole institution.
 */
export async function loadRoster(service: SupabaseClient<Database>, ctx: OrgContext, filters: RosterFilters): Promise<{ rows: RosterRow[]; branches: string[]; years: number[]; truncated: boolean }> {
  const { data } = await service
    .from("institution_memberships")
    .select("user_id, branch, end_year, roll_number, roll_number_status")
    .eq("institution_id", ctx.institutionId)
    .eq("role", "student")
    .eq("status", "active")
    .order("branch")
    .limit(MAX_ROWS + 1);
  const all = data ?? [];
  const truncated = all.length > MAX_ROWS;

  const scopeBranch = ctx.kind === "staff" && ctx.branch ? ctx.branch.trim().toLowerCase() : null;
  const scoped = all.slice(0, MAX_ROWS).filter((m) => !scopeBranch || (m.branch ?? "").trim().toLowerCase() === scopeBranch);
  const branches = [...new Set(scoped.map((m) => m.branch).filter((b): b is string => Boolean(b)))].sort();
  const years = [...new Set(scoped.map((m) => m.end_year).filter((y): y is number => y !== null))].sort((a, b) => b - a);

  const visible = scoped.filter(
    (m) => (!filters.branch || (m.branch ?? "").toLowerCase() === filters.branch.toLowerCase()) && (!filters.endYear || m.end_year === filters.endYear)
  );
  const ids = visible.map((m) => m.user_id);
  if (ids.length === 0) return { rows: [], branches, years, truncated };

  const since = new Date(Date.now() - 30 * DAY).toISOString();
  const [profiles, members, evidence, arena] = await Promise.all([
    service.from("profiles").select("id, full_name, email").in("id", ids),
    untyped(service).from("class_project_group_members").select("user_id").in("user_id", ids),
    service.from("evidence").select("user_id").in("user_id", ids).eq("evidence_type", "staff_graded_project"),
    service.from("arena_attempt_completions").select("user_id").in("user_id", ids).gte("completed_at", since),
  ]);
  const names = new Map((profiles.data ?? []).map((p) => [p.id, p.full_name ?? p.email]));
  const tally = (rows: { user_id: string }[] | null) => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) m.set(r.user_id, (m.get(r.user_id) ?? 0) + 1);
    return m;
  };
  const groups = tally(members.data as { user_id: string }[] | null);
  const graded = tally(evidence.data);
  const arenaCounts = tally(arena.data);

  const rows = visible
    .map((m): RosterRow => ({
      userId: m.user_id,
      name: names.get(m.user_id) ?? "Student",
      branch: m.branch,
      endYear: m.end_year,
      rollNumber: m.roll_number,
      rollStatus: m.roll_number_status === "verified" || m.roll_number_status === "flagged" ? m.roll_number_status : "unchecked",
      groups: groups.get(m.user_id) ?? 0,
      gradedProjects: graded.get(m.user_id) ?? 0,
      arenaLast30: arenaCounts.get(m.user_id) ?? 0,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return { rows, branches, years, truncated };
}
