import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { OrgContext } from "./context";
import { IN_APP_APPROVABLE_ROLES, type OrgPermissionKey } from "./roles";
import { untyped, type GroupRow, type OrgPostRow, type ProjectRow } from "./db";

export interface Alert {
  tone: "red" | "amber" | "blue";
  label: string;
  sub: string;
  href: string;
}

export interface HomeCounts {
  pendingMembers: number;
  awaitingGrading: number;
  applicantsToReview: number;
  drivesClosingSoon: number;
  projectsClosingWithOpenGroups: number;
}

/** Pure. The "what needs attention now?" list — only items that exist, most urgent first, never more than 5. */
export function buildAlerts(perms: ReadonlySet<OrgPermissionKey>, c: HomeCounts): Alert[] {
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const all: (Alert | false)[] = [
    perms.has("classroom") &&
      c.awaitingGrading > 0 && { tone: "red", label: `${plural(c.awaitingGrading, "group is", "groups are")} waiting for a grade`, sub: "Submitted work is ready for review", href: "/org/projects" },
    perms.has("placements") &&
      c.applicantsToReview > 0 && { tone: "amber", label: `${plural(c.applicantsToReview, "applicant needs", "applicants need")} a decision`, sub: "Shortlist or reject on the company visit page", href: "/org/placements" },
    perms.has("placements") &&
      c.drivesClosingSoon > 0 && { tone: "amber", label: `${plural(c.drivesClosingSoon, "drive closes", "drives close")} within 3 days`, sub: "Remind eligible students", href: "/org/placements" },
    perms.has("classroom") &&
      c.projectsClosingWithOpenGroups > 0 && { tone: "amber", label: `${plural(c.projectsClosingWithOpenGroups, "project has", "projects have")} groups still forming near the deadline`, sub: "Some students may not be able to submit", href: "/org/projects" },
    perms.has("members") && c.pendingMembers > 0 && { tone: "blue", label: `${plural(c.pendingMembers, "staff member is", "staff members are")} waiting for approval`, sub: "Approve or reject applications", href: "/org/team" },
  ];
  return all.filter((a): a is Alert => Boolean(a)).slice(0, 5);
}

export interface UpcomingItem {
  kind: "event" | "project" | "drive";
  title: string;
  at: string;
  detail: string;
  href: string;
}

const DAY = 86_400_000;

export async function loadHome(service: SupabaseClient<Database>, ctx: OrgContext) {
  const db = untyped(service);
  const now = new Date();
  const nowIso = now.toISOString();
  const soonIso = new Date(now.getTime() + 3 * DAY).toISOString();
  const horizonIso = new Date(now.getTime() + 14 * DAY).toISOString();
  const today = nowIso.slice(0, 10);
  const soonDate = soonIso.slice(0, 10);
  const horizonDate = horizonIso.slice(0, 10);
  const manages = ctx.permissions.has("classroom");
  const runsPlacements = ctx.permissions.has("placements");

  // projects this person manages (admin: all; staff: own)
  let pq = db.from("class_projects").select("*").eq("institution_id", ctx.institutionId);
  if (ctx.kind !== "admin") pq = pq.eq("created_by_membership_id", ctx.membershipId);
  const projects = manages ? (((await pq).data ?? []) as ProjectRow[]) : [];
  const projectIds = projects.map((p) => p.id);
  const groups = projectIds.length ? (((await db.from("class_project_groups").select("id, project_id, name, status, created_at").in("project_id", projectIds)).data ?? []) as GroupRow[]) : [];
  const awaiting = groups.filter((g) => g.status === "submitted");
  const openProjects = projects.filter((p) => p.status === "open");

  const closingWithForming = openProjects.filter(
    (p) => new Date(p.deadline_at).toISOString() <= soonIso && new Date(p.deadline_at).toISOString() >= nowIso && groups.some((g) => g.project_id === p.id && g.status === "forming")
  );

  const [drivesRes, studentsRes, pendingRes, placedRes, eventsRes] = await Promise.all([
    runsPlacements ? service.from("opportunities").select("id, role, company, deadline").eq("institution_id", ctx.institutionId) : Promise.resolve({ data: [] }),
    service.from("institution_memberships").select("id", { count: "exact", head: true }).eq("institution_id", ctx.institutionId).eq("role", "student").eq("status", "active"),
    ctx.permissions.has("members")
      ? service.from("institution_memberships").select("id", { count: "exact", head: true }).eq("institution_id", ctx.institutionId).eq("status", "pending").in("role", [...IN_APP_APPROVABLE_ROLES] as never[])
      : Promise.resolve({ count: 0 }),
    runsPlacements ? db.from("org_placements").select("id", { count: "exact", head: true }).eq("institution_id", ctx.institutionId) : Promise.resolve({ count: 0 }),
    db.from("org_posts").select("*").eq("institution_id", ctx.institutionId).eq("type", "event").eq("status", "published").gte("event_starts_at", nowIso).order("event_starts_at").limit(5),
  ]);
  const drives = (drivesRes.data ?? []) as { id: string; role: string; company: string; deadline: string | null }[];
  const driveIds = drives.map((d) => d.id);
  const apps = driveIds.length ? ((await service.from("applications").select("status, opportunity_id").in("opportunity_id", driveIds)).data ?? []) : [];
  const events = (eventsRes.data ?? []) as OrgPostRow[];

  const openDrives = drives.filter((d) => !d.deadline || d.deadline >= today);
  const counts: HomeCounts = {
    pendingMembers: pendingRes.count ?? 0,
    awaitingGrading: awaiting.length,
    applicantsToReview: apps.filter((a) => a.status === "submitted").length,
    drivesClosingSoon: openDrives.filter((d) => d.deadline && d.deadline <= soonDate).length,
    projectsClosingWithOpenGroups: closingWithForming.length,
  };

  const projectTitle = new Map(projects.map((p) => [p.id, p.title]));
  const queue = awaiting.slice(0, 6).map((g) => ({ groupId: g.id, projectId: g.project_id, groupName: g.name, projectTitle: projectTitle.get(g.project_id) ?? "Project" }));

  const upcoming: UpcomingItem[] = [
    ...events.map((e): UpcomingItem => ({ kind: "event", title: e.title, at: e.event_starts_at!, detail: e.event_location ?? "Event", href: "/org/college" })),
    ...openProjects
      .filter((p) => p.deadline_at <= horizonIso && p.deadline_at >= nowIso)
      .map((p): UpcomingItem => ({ kind: "project", title: p.title, at: p.deadline_at, detail: "Project deadline", href: `/org/projects/${p.id}` })),
    ...openDrives
      .filter((d) => d.deadline && d.deadline <= horizonDate)
      .map((d): UpcomingItem => ({ kind: "drive", title: `${d.role} · ${d.company}`, at: `${d.deadline}T23:59:00Z`, detail: "Registration closes", href: `/org/placements/${d.id}` })),
  ]
    .sort((a, b) => a.at.localeCompare(b.at))
    .slice(0, 6);

  return {
    counts,
    alerts: buildAlerts(ctx.permissions, counts),
    queue,
    upcoming,
    kpis: {
      students: studentsRes.count ?? 0,
      openProjects: openProjects.length,
      openDrives: openDrives.length,
      placed: placedRes.count ?? 0,
      applicants: apps.length,
    },
  };
}
