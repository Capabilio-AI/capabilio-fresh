import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { onlyCurrentStudents } from "./current-students";
import { sameBranch } from "./branch-scope";
import { untyped, type ProjectRow } from "./db";
import { nameMap, type GroupDetail } from "./loaders";

type Service = SupabaseClient<Database>;

export interface GroupCounts { forming: number; active: number; submitted: number; graded: number; total: number }

/** Pure. How many groups are at each stage. */
export function countGroups(groups: { group: { status: string } }[]): GroupCounts {
  const n = { forming: 0, active: 0, submitted: 0, graded: 0, total: groups.length };
  for (const g of groups) if (g.group.status in n) n[g.group.status as "forming" | "active" | "submitted" | "graded"] += 1;
  return n;
}

/** Pure. Groups that need staff first: submitted and waiting for a grade, then the rest in the order they formed. */
export function orderForStaff<T extends { group: { status: string } }>(groups: T[]): T[] {
  const rank = (s: string) => (s === "submitted" ? 0 : s === "active" ? 1 : s === "forming" ? 2 : 3);
  return [...groups].sort((a, b) => rank(a.group.status) - rank(b.group.status));
}

/** Pure. A project's department scope is empty/null for "everyone", otherwise an exact (case-insensitive) branch match, the same rule the database enforces. */
export const inProjectScope = (scope: string[] | null, branch: string | null): boolean => !scope || scope.length === 0 || scope.some((s) => sameBranch(s, branch));

export interface ProjectProgress {
  assignedBy: { name: string; role: string } | null;
  /** current students of the college whose department the project is open to */
  eligible: number;
  inGroup: number;
  /** the first few students who have not joined a group, by name */
  notInGroup: { userId: string; name: string; branch: string | null }[];
  notInGroupTotal: number;
  counts: GroupCounts;
}

const PAGE = 1000;
const MAX = 20_000;
const LIST_LIMIT = 40;

/** Who posted the project, who it reaches, and who has not formed a group yet. Student ids only; names load for the few shown. */
export async function loadProjectProgress(service: Service, project: ProjectRow, groups: GroupDetail[]): Promise<ProjectProgress> {
  const db = untyped(service);
  const students: { user_id: string; branch: string | null }[] = [];
  for (let from = 0; from < MAX; from += PAGE) {
    const { data, error } = await onlyCurrentStudents(db.from("institution_memberships").select("user_id, branch").eq("institution_id", project.institution_id).eq("role", "student").eq("status", "active"))
      .order("user_id")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Project progress failed: ${error.message}`);
    students.push(...((data ?? []) as { user_id: string; branch: string | null }[]));
    if (!data || data.length < PAGE) break;
  }
  const eligible = students.filter((s) => inProjectScope(project.department_scope, s.branch));
  const grouped = new Set(groups.flatMap((g) => g.members.map((m) => m.user_id)));
  const waiting = eligible.filter((s) => !grouped.has(s.user_id));
  const shown = waiting.slice(0, LIST_LIMIT);

  const { data: creator } = await db.from("institution_memberships").select("user_id, role").eq("id", project.created_by_membership_id).maybeSingle();
  const creatorRow = creator as { user_id: string; role: string } | null;
  const names = await nameMap(service, [...shown.map((s) => s.user_id), ...(creatorRow ? [creatorRow.user_id] : [])]);
  return {
    assignedBy: creatorRow ? { name: names.get(creatorRow.user_id) ?? "Staff", role: creatorRow.role } : null,
    eligible: eligible.length,
    inGroup: eligible.length - waiting.length,
    notInGroup: shown.map((s) => ({ userId: s.user_id, name: names.get(s.user_id) ?? "Student", branch: s.branch })),
    notInGroupTotal: waiting.length,
    counts: countGroups(groups),
  };
}
