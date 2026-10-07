import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { OrgContext } from "./context";
import {
  untyped,
  type GradeRow,
  type GroupMemberRow,
  type GroupRow,
  type MaterialRow,
  type ProjectRow,
  type ReportRow,
  type SubmissionRow,
} from "./db";

import { sameBranch } from "./branch-scope";

type Service = SupabaseClient<Database>;

export async function nameMap(service: Service, userIds: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return new Map();
  const { data } = await service.from("profiles").select("id, full_name, email").in("id", ids);
  return new Map((data ?? []).map((p) => [p.id, p.full_name ?? p.email]));
}

export interface SubjectOption {
  id: string;
  label: string;
}

/** `branch` limits the list to one department (faculty/HoD are confined to their own). */
export async function listSubjects(service: Service, institutionId: string, branch: string | null = null): Promise<SubjectOption[]> {
  const { data } = await service
    .from("curriculum_subjects")
    .select("id, name, branch, year")
    .eq("institution_id", institutionId)
    .order("branch")
    .order("year")
    .order("name");
  return (data ?? []).filter((s) => !branch || sameBranch(s.branch, branch)).map((s) => ({ id: s.id, label: `${s.branch} · Year ${s.year} · ${s.name}` }));
}

/** Staff see the materials they authored; admins see everything at their institution. */
export async function listMaterialsForStaff(service: Service, ctx: OrgContext): Promise<MaterialRow[]> {
  let q = untyped(service).from("class_materials").select("*").eq("institution_id", ctx.institutionId).order("published_at", { ascending: false }).limit(100);
  if (ctx.kind !== "admin") q = q.eq("author_membership_id", ctx.membershipId);
  return ((await q).data ?? []) as MaterialRow[];
}

export interface ProjectSummary extends ProjectRow {
  groupCount: number;
  submitted: number;
  graded: number;
}

export async function listProjectsForStaff(service: Service, ctx: OrgContext): Promise<ProjectSummary[]> {
  const db = untyped(service);
  let q = db.from("class_projects").select("*").eq("institution_id", ctx.institutionId).order("created_at", { ascending: false });
  if (ctx.kind !== "admin") q = q.eq("created_by_membership_id", ctx.membershipId);
  const projects = ((await q).data ?? []) as ProjectRow[];
  if (projects.length === 0) return [];
  const { data: groups } = await db.from("class_project_groups").select("project_id, status").in("project_id", projects.map((p) => p.id));
  const rows = (groups ?? []) as Pick<GroupRow, "project_id" | "status">[];
  return projects.map((p) => {
    const g = rows.filter((r) => r.project_id === p.id);
    return { ...p, groupCount: g.length, submitted: g.filter((x) => x.status === "submitted" || x.status === "graded").length, graded: g.filter((x) => x.status === "graded").length };
  });
}

export interface GroupDetail {
  group: GroupRow;
  members: (GroupMemberRow & { name: string })[];
  reports: ReportRow[];
  submission: SubmissionRow | null;
  grade: GradeRow | null;
}

export async function loadProjectGroups(service: Service, projectId: string): Promise<GroupDetail[]> {
  const db = untyped(service);
  const groups = ((await db.from("class_project_groups").select("*").eq("project_id", projectId).order("created_at")).data ?? []) as GroupRow[];
  if (groups.length === 0) return [];
  const ids = groups.map((g) => g.id);
  const [members, reports, subs, grades] = await Promise.all([
    db.from("class_project_group_members").select("*").in("group_id", ids).order("joined_at"),
    db.from("class_weekly_reports").select("*").in("group_id", ids).order("week_number"),
    db.from("class_submissions").select("*").in("group_id", ids),
    db.from("class_project_grades").select("*").in("group_id", ids),
  ]);
  const memberRows = (members.data ?? []) as GroupMemberRow[];
  const names = await nameMap(service, memberRows.map((m) => m.user_id));
  return groups.map((group) => ({
    group,
    members: memberRows.filter((m) => m.group_id === group.id).map((m) => ({ ...m, name: names.get(m.user_id) ?? "Student" })),
    reports: ((reports.data ?? []) as ReportRow[]).filter((r) => r.group_id === group.id),
    submission: ((subs.data ?? []) as SubmissionRow[]).find((s) => s.group_id === group.id) ?? null,
    grade: ((grades.data ?? []) as GradeRow[]).find((g) => g.group_id === group.id) ?? null,
  }));
}

// ---------------- student side ----------------

export interface StudentProject extends ProjectRow {
  /** open and before its deadline, evaluated server-side at load time */
  acceptingWork: boolean;
  myGroup: GroupDetail | null;
  openGroups: { group: GroupRow; memberCount: number; memberBranches: string[] }[];
}

export const inScope = (scope: string[] | null, branch: string | null) =>
  !scope || scope.length === 0 || (branch !== null && scope.some((s) => s.trim().toLowerCase() === branch.trim().toLowerCase()));

/** Projects open to this student's department, with their own group and the open-slots board. */
export async function loadStudentProjects(service: Service, ctx: OrgContext): Promise<StudentProject[]> {
  const db = untyped(service);
  const projects = (((await db.from("class_projects").select("*").eq("institution_id", ctx.institutionId).neq("status", "archived").order("deadline_at")).data ?? []) as ProjectRow[]).filter((p) =>
    inScope(p.department_scope, ctx.branch)
  );
  if (projects.length === 0) return [];
  const ids = projects.map((p) => p.id);
  const [{ data: groupRows }, { data: memberRows }] = await Promise.all([
    db.from("class_project_groups").select("*").in("project_id", ids),
    db.from("class_project_group_members").select("*").in("project_id", ids),
  ]);
  const groups = (groupRows ?? []) as GroupRow[];
  const members = (memberRows ?? []) as GroupMemberRow[];
  const mine = new Set(members.filter((m) => m.user_id === ctx.userId).map((m) => m.group_id));
  const myDetails = new Map<string, GroupDetail>();
  for (const project of projects) {
    const g = groups.find((x) => mine.has(x.id) && x.project_id === project.id);
    if (g) {
      const detail = (await loadProjectGroups(service, project.id)).find((d) => d.group.id === g.id);
      if (detail) myDetails.set(project.id, detail);
    }
  }
  const now = Date.now();
  return projects.map((project) => ({
    ...project,
    acceptingWork: project.status === "open" && new Date(project.deadline_at).getTime() > now,
    myGroup: myDetails.get(project.id) ?? null,
    openGroups: groups
      .filter((g) => g.project_id === project.id && g.status === "forming" && !mine.has(g.id))
      .map((g) => {
        const ms = members.filter((m) => m.group_id === g.id);
        return { group: g, memberCount: ms.length, memberBranches: [...new Set(ms.map((m) => m.branch).filter((b): b is string => Boolean(b)))] };
      }),
  }));
}

/** Materials for the student's own branch (case-insensitive) — and, when known, their current year. */
export async function loadStudentMaterials(service: Service, ctx: OrgContext, currentYear: number | null): Promise<MaterialRow[]> {
  if (!ctx.branch) return [];
  const rows = (((await untyped(service).from("class_materials").select("*").eq("institution_id", ctx.institutionId).order("published_at", { ascending: false }).limit(200)).data ?? []) as MaterialRow[]).filter(
    (m) => m.branch.trim().toLowerCase() === ctx.branch!.trim().toLowerCase()
  );
  return currentYear ? rows.filter((m) => m.year === currentYear) : rows;
}
