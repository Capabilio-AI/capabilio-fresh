import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { OrgContext } from "./context";
import { IN_APP_APPROVABLE_ROLES, type OrgPermissionKey } from "./roles";
import { untyped, type GroupRow, type OrgPostRow, type ProjectRow } from "./db";
import { endOfDayIst, istDate } from "./format";

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
  // drive deadlines are date-only, so "today" is the Indian calendar date, not the server's UTC date
  const today = istDate(now);
  const soonDate = istDate(new Date(soonIso));
  const horizonDate = istDate(new Date(horizonIso));
  const manages = ctx.permissions.has("classroom");
  const runsPlacements = ctx.permissions.has("placements");

  // two independent chains run side by side: projects -> groups, and drives -> applications (+ the plain counts)
  const projectChain = async () => {
    let pq = db.from("class_projects").select("*").eq("institution_id", ctx.institutionId);
    if (ctx.kind !== "admin") pq = pq.eq("created_by_membership_id", ctx.membershipId);
    const projectsRes = manages ? await pq : { data: [], error: null };
    if (projectsRes.error) throw new Error(`Home load failed: ${projectsRes.error.message}`);
    const projects = (projectsRes.data ?? []) as ProjectRow[];
    const projectIds = projects.map((p) => p.id);
    const groupsRes = projectIds.length ? await db.from("class_project_groups").select("id, project_id, name, status, created_at").in("project_id", projectIds) : { data: [], error: null };
    if (groupsRes.error) throw new Error(`Home load failed: ${groupsRes.error.message}`);
    const groups = (groupsRes.data ?? []) as GroupRow[];
    return { projects, groups };
  };
  const driveChain = async () => {
    const [drivesRes, studentsRes, pendingRes, placedRes, eventsRes] = await Promise.all([
      runsPlacements ? service.from("opportunities").select("id, role, company, deadline, drive_status").eq("institution_id", ctx.institutionId) : Promise.resolve({ data: [] }),
      service.from("institution_memberships").select("id", { count: "exact", head: true }).eq("institution_id", ctx.institutionId).eq("role", "student").eq("status", "active"),
      ctx.permissions.has("members")
        ? service.from("institution_memberships").select("id", { count: "exact", head: true }).eq("institution_id", ctx.institutionId).eq("status", "pending").in("role", [...IN_APP_APPROVABLE_ROLES] as never[])
        : Promise.resolve({ count: 0 }),
      runsPlacements ? db.from("org_placements").select("id", { count: "exact", head: true }).eq("institution_id", ctx.institutionId) : Promise.resolve({ count: 0 }),
      db.from("org_posts").select("*").eq("institution_id", ctx.institutionId).eq("type", "event").eq("status", "published").gte("event_starts_at", nowIso).order("event_starts_at").limit(5),
    ]);
    if (studentsRes.error) throw new Error(`Home load failed: ${studentsRes.error.message}`);
    if ("error" in drivesRes && drivesRes.error) throw new Error(`Home load failed: ${drivesRes.error.message}`);
    const drives = ((drivesRes.data ?? []) as { id: string; role: string; company: string; deadline: string | null; drive_status?: string | null }[]).filter((d) => !d.drive_status || d.drive_status === "planned" || d.drive_status === "registration_open");
    const driveIds = drives.map((d) => d.id);
    const appsRes = driveIds.length ? await service.from("applications").select("status, opportunity_id").in("opportunity_id", driveIds) : { data: [], error: null };
    if (appsRes.error) throw new Error(`Home load failed: ${appsRes.error.message}`);
    const apps = appsRes.data ?? [];
    return { drives, apps, studentsRes, pendingRes, placedRes, events: (eventsRes.data ?? []) as OrgPostRow[] };
  };
  const [{ projects, groups }, { drives, apps, studentsRes, pendingRes, placedRes, events }] = await Promise.all([projectChain(), driveChain()]);
  const awaiting = groups.filter((g) => g.status === "submitted");
  const openProjects = projects.filter((p) => p.status === "open");

  const closingWithForming = openProjects.filter(
    (p) => new Date(p.deadline_at).toISOString() <= soonIso && new Date(p.deadline_at).toISOString() >= nowIso && groups.some((g) => g.project_id === p.id && g.status === "forming")
  );

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
      .map((d): UpcomingItem => ({ kind: "drive", title: `${d.role} · ${d.company}`, at: endOfDayIst(d.deadline!), detail: "Registration closes", href: `/org/placements/${d.id}` })),
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
