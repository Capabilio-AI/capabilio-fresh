import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { untyped, type GradeRow, type GroupMemberRow, type GroupRow, type MaterialRow, type ProjectRow } from "./db";

/** Cohorts smaller than this never show a breakdown — a group of 2 would identify individuals. */
export const MIN_COHORT = 5;

export const GOAL_KEYS = ["job", "higher_studies", "entrepreneur", "not_sure", "unset"] as const;
export type GoalKey = (typeof GOAL_KEYS)[number];

export interface StudentSignal {
  userId: string;
  branch: string | null;
  endYear: number | null;
  goalState: string | null;
}

export interface CohortSummary {
  branch: string;
  endYear: number | null;
  size: number;
  /** null when size < MIN_COHORT (suppressed) */
  goals: Record<GoalKey, number> | null;
  /** students in at least one project group / size; null when suppressed */
  projectParticipation: number | null;
}

const goalKey = (g: string | null): GoalKey => (g === "job" || g === "higher_studies" || g === "entrepreneur" || g === "not_sure" ? g : "unset");

/** Pure. Aggregates only; no individual is ever returned. */
export function summarizeCohorts(students: StudentSignal[], participantIds: Set<string>): CohortSummary[] {
  const buckets = new Map<string, StudentSignal[]>();
  for (const s of students) {
    const key = `${(s.branch ?? "Unspecified").trim()}|${s.endYear ?? ""}`;
    buckets.set(key, [...(buckets.get(key) ?? []), s]);
  }
  return [...buckets.entries()]
    .map(([key, members]): CohortSummary => {
      const [branch, year] = key.split("|");
      const visible = members.length >= MIN_COHORT;
      const goals = { job: 0, higher_studies: 0, entrepreneur: 0, not_sure: 0, unset: 0 } as Record<GoalKey, number>;
      for (const m of members) goals[goalKey(m.goalState)] += 1;
      return {
        branch,
        endYear: year ? Number(year) : null,
        size: members.length,
        goals: visible ? goals : null,
        projectParticipation: visible ? members.filter((m) => participantIds.has(m.userId)).length / members.length : null,
      };
    })
    .sort((a, b) => a.branch.localeCompare(b.branch) || (b.endYear ?? 0) - (a.endYear ?? 0));
}

export interface ProjectSignal {
  projects: number;
  groups: number;
  submitted: number;
  graded: number;
  /** grade -> count; null until MIN_COHORT graded groups exist */
  gradeDistribution: Record<string, number> | null;
  materialsByBranch: { branch: string; count: number }[];
}

export function summarizeProjects(projects: number, groups: Pick<GroupRow, "status">[], grades: Pick<GradeRow, "grade">[], materials: Pick<MaterialRow, "branch">[]): ProjectSignal {
  const dist: Record<string, number> = {};
  for (const g of grades) dist[g.grade.toUpperCase()] = (dist[g.grade.toUpperCase()] ?? 0) + 1;
  const byBranch = new Map<string, number>();
  for (const m of materials) byBranch.set(m.branch, (byBranch.get(m.branch) ?? 0) + 1);
  return {
    projects,
    groups: groups.length,
    submitted: groups.filter((g) => g.status === "submitted" || g.status === "graded").length,
    graded: groups.filter((g) => g.status === "graded").length,
    gradeDistribution: grades.length >= MIN_COHORT ? dist : null,
    materialsByBranch: [...byBranch.entries()].map(([branch, count]) => ({ branch, count })).sort((a, b) => a.branch.localeCompare(b.branch)),
  };
}

export async function loadInsights(service: SupabaseClient<Database>, institutionId: string) {
  const db = untyped(service);
  const { data: students } = await service
    .from("institution_memberships")
    .select("user_id, branch, end_year, goal_state")
    .eq("institution_id", institutionId)
    .eq("role", "student")
    .eq("status", "active");
  const projects = ((await db.from("class_projects").select("id").eq("institution_id", institutionId)).data ?? []) as Pick<ProjectRow, "id">[];
  const ids = projects.map((p) => p.id);
  const [groupsRes, membersRes, materialsRes] = await Promise.all([
    ids.length ? db.from("class_project_groups").select("id, status").in("project_id", ids) : Promise.resolve({ data: [] }),
    ids.length ? db.from("class_project_group_members").select("user_id").in("project_id", ids) : Promise.resolve({ data: [] }),
    db.from("class_materials").select("branch").eq("institution_id", institutionId),
  ]);
  const groups = (groupsRes.data ?? []) as (Pick<GroupRow, "status"> & { id: string })[];
  const gradesRes = groups.length ? await db.from("class_project_grades").select("grade").in("group_id", groups.map((g) => g.id)) : { data: [] };
  const participants = new Set(((membersRes.data ?? []) as Pick<GroupMemberRow, "user_id">[]).map((m) => m.user_id));
  return {
    cohorts: summarizeCohorts(
      (students ?? []).map((s) => ({ userId: s.user_id, branch: s.branch, endYear: s.end_year, goalState: s.goal_state })),
      participants
    ),
    projects: summarizeProjects(projects.length, groups, (gradesRes.data ?? []) as Pick<GradeRow, "grade">[], (materialsRes.data ?? []) as Pick<MaterialRow, "branch">[]),
  };
}
