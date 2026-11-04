import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { OrgContext } from "./context";
import { untyped } from "./db";
import { nameMap } from "./loaders";

type Service = SupabaseClient<Database>;
type Status = "pending" | "accepted" | "rejected" | "cancelled";

export interface MentorOption { membershipId: string; name: string; role: string; branch: string | null }
export interface MentorRequestView { id: string; mentorMembershipId: string; mentorName: string; status: Status; reason: string | null; message: string | null }
export interface GroupMentorship { mentor: { name: string; role: string } | null; requests: MentorRequestView[]; options: MentorOption[] }

const MENTOR_ROLES = ["faculty", "hod"];

/** Faculty and HoDs of a college a group may ask, with their names. The group's own members are never offered. */
export async function loadMentorOptions(service: Service, institutionId: string, excludeUserIds: string[]): Promise<MentorOption[]> {
  const { data } = await untyped(service).from("institution_memberships").select("id, user_id, role, branch").eq("institution_id", institutionId).eq("status", "active").in("role", MENTOR_ROLES);
  const rows = ((data ?? []) as { id: string; user_id: string; role: string; branch: string | null }[]).filter((r) => !excludeUserIds.includes(r.user_id));
  const names = await nameMap(service, rows.map((r) => r.user_id));
  return rows.map((r) => ({ membershipId: r.id, name: names.get(r.user_id) ?? "Staff", role: r.role, branch: r.branch })).sort((a, b) => a.name.localeCompare(b.name));
}

/** A missing table (migration not applied yet) reads as "no mentor requests" rather than breaking the page. */
async function requestRows(service: Service, column: "group_id" | "project_id" | "mentor_membership_id", value: string) {
  const { data } = await untyped(service).from("class_group_mentor_requests").select("id, group_id, project_id, requested_by_user_id, mentor_membership_id, message, status, reject_reason, created_at").eq(column, value).order("created_at", { ascending: false });
  return (data ?? []) as { id: string; group_id: string; project_id: string; requested_by_user_id: string; mentor_membership_id: string; message: string | null; status: Status; reject_reason: string | null; created_at: string }[];
}

async function mentorLabels(service: Service, membershipIds: string[]) {
  if (membershipIds.length === 0) return new Map<string, { name: string; role: string }>();
  const { data } = await untyped(service).from("institution_memberships").select("id, user_id, role").in("id", membershipIds);
  const rows = (data ?? []) as { id: string; user_id: string; role: string }[];
  const names = await nameMap(service, rows.map((r) => r.user_id));
  return new Map(rows.map((r) => [r.id, { name: names.get(r.user_id) ?? "Staff", role: r.role }]));
}

/** What a group sees about mentorship: its mentor if it has one, its requests and what to do next, and who it can still ask. */
export async function loadGroupMentorship(service: Service, groupId: string, institutionId: string, memberUserIds: string[]): Promise<GroupMentorship> {
  const rows = await requestRows(service, "group_id", groupId);
  const labels = await mentorLabels(service, [...new Set(rows.map((r) => r.mentor_membership_id))]);
  const requests: MentorRequestView[] = rows.map((r) => ({ id: r.id, mentorMembershipId: r.mentor_membership_id, mentorName: labels.get(r.mentor_membership_id)?.name ?? "Staff", status: r.status, reason: r.reject_reason, message: r.message }));
  const accepted = rows.find((r) => r.status === "accepted");
  return {
    mentor: accepted ? labels.get(accepted.mentor_membership_id) ?? { name: "Staff", role: "faculty" } : null,
    requests,
    options: accepted ? [] : await loadMentorOptions(service, institutionId, memberUserIds),
  };
}

/** Accepted mentor name per group for a project, so staff see who mentors whom. */
export async function loadProjectMentors(service: Service, projectId: string): Promise<Map<string, string>> {
  const rows = (await requestRows(service, "project_id", projectId)).filter((r) => r.status === "accepted");
  const labels = await mentorLabels(service, rows.map((r) => r.mentor_membership_id));
  return new Map(rows.map((r) => [r.group_id, labels.get(r.mentor_membership_id)?.name ?? "Staff"]));
}

export interface MentorInboxItem { id: string; groupName: string; projectId: string; projectTitle: string; requestedBy: string; message: string | null; createdAt: string }
export interface MentoredGroup { groupId: string; groupName: string; projectId: string; projectTitle: string; status: string; members: string[] }

/** For a staff member: requests waiting on them, and the groups they mentor. */
export async function loadMentorInbox(service: Service, ctx: OrgContext): Promise<{ pending: MentorInboxItem[]; mentoring: MentoredGroup[] }> {
  const rows = await requestRows(service, "mentor_membership_id", ctx.membershipId);
  const live = rows.filter((r) => r.status === "pending" || r.status === "accepted");
  if (live.length === 0) return { pending: [], mentoring: [] };
  const db = untyped(service);
  const groupIds = [...new Set(live.map((r) => r.group_id))];
  const projectIds = [...new Set(live.map((r) => r.project_id))];
  const [{ data: groups }, { data: projects }, { data: members }] = await Promise.all([
    db.from("class_project_groups").select("id, name, status").in("id", groupIds),
    db.from("class_projects").select("id, title").in("id", projectIds),
    db.from("class_project_group_members").select("group_id, user_id").in("group_id", groupIds),
  ]);
  const requesterIds = live.map((r) => r.requested_by_user_id);
  const memberRows = (members ?? []) as { group_id: string; user_id: string }[];
  const names = await nameMap(service, [...memberRows.map((m) => m.user_id), ...requesterIds]);
  const groupById = new Map(((groups ?? []) as { id: string; name: string; status: string }[]).map((g) => [g.id, g]));
  const projectById = new Map(((projects ?? []) as { id: string; title: string }[]).map((p) => [p.id, p.title]));
  const item = (r: (typeof live)[number]) => ({ groupName: groupById.get(r.group_id)?.name ?? "Group", projectId: r.project_id, projectTitle: projectById.get(r.project_id) ?? "Project" });
  return {
    pending: live.filter((r) => r.status === "pending").map((r) => ({ id: r.id, ...item(r), requestedBy: names.get(r.requested_by_user_id) ?? "A student", message: r.message, createdAt: r.created_at })),
    mentoring: live.filter((r) => r.status === "accepted").map((r) => ({ groupId: r.group_id, ...item(r), status: groupById.get(r.group_id)?.status ?? "forming", members: memberRows.filter((m) => m.group_id === r.group_id).map((m) => names.get(m.user_id) ?? "Student") })),
  };
}
