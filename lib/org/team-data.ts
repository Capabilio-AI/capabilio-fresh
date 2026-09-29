import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { OrgContext } from "./context";
import { untyped } from "./db";
import { IN_APP_APPROVABLE_ROLES, effectivePermissions, kindOf, type OrgPermissionKey } from "./roles";
import { newJoinCode } from "./team";

export interface TeamMember {
  membershipId: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  isAdmin: boolean;
  isSelf: boolean;
  /** what they can do right now */
  permissions: OrgPermissionKey[];
  /** an admin customised this person's set (otherwise the role default applies) */
  custom: boolean;
  status: "active" | "pending";
}

export interface OpenInvitation {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  createdAt: string;
  expired: boolean;
}

export interface JoinLinkRow {
  id: string;
  code: string;
  label: string | null;
  branch: string | null;
  endYear: number | null;
  active: boolean;
  joined: number;
}

export async function loadTeam(service: SupabaseClient<Database>, ctx: OrgContext) {
  const db = untyped(service);
  const [membersRes, invitesRes] = await Promise.all([
    db.from("institution_memberships").select("id, user_id, role, status, permissions").eq("institution_id", ctx.institutionId).neq("role", "student").in("status", ["active", "pending"]).order("created_at"),
    db.from("org_invitations").select("id, email, role, expires_at, created_at").eq("institution_id", ctx.institutionId).is("accepted_at", null).is("revoked_at", null).order("created_at", { ascending: false }),
  ]);
  const rows = (membersRes.data ?? []) as { id: string; user_id: string; role: string; status: "active" | "pending"; permissions: string[] | null }[];
  const ids = rows.map((r) => r.user_id);
  const { data: profiles } = ids.length ? await service.from("profiles").select("id, full_name, email").in("id", ids) : { data: [] };
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));

  const members: TeamMember[] = rows
    .filter((r) => kindOf(r.role) !== null)
    .map((r) => ({
      membershipId: r.id,
      userId: r.user_id,
      name: byId.get(r.user_id)?.full_name ?? byId.get(r.user_id)?.email ?? "Member",
      email: byId.get(r.user_id)?.email ?? "",
      role: r.role,
      isAdmin: kindOf(r.role) === "admin",
      isSelf: r.user_id === ctx.userId,
      permissions: [...effectivePermissions(r.role, r.permissions)],
      custom: r.permissions !== null && kindOf(r.role) !== "admin",
      status: r.status,
    }));

  const now = Date.now();
  const invitations: OpenInvitation[] = ((invitesRes.data ?? []) as { id: string; email: string; role: string; expires_at: string; created_at: string }[]).map((i) => ({
    id: i.id,
    email: i.email,
    role: i.role,
    expiresAt: i.expires_at,
    createdAt: i.created_at,
    expired: new Date(i.expires_at).getTime() < now,
  }));

  return {
    active: members.filter((m) => m.status === "active"),
    pending: members.filter((m) => m.status === "pending" && (IN_APP_APPROVABLE_ROLES as readonly string[]).includes(m.role)),
    invitations,
  };
}

/** The college always has a general student join link; created the first time an admin opens the team page. */
export async function loadJoinLinks(service: SupabaseClient<Database>, ctx: OrgContext): Promise<JoinLinkRow[]> {
  const db = untyped(service);
  let { data } = await db.from("org_join_links").select("*").eq("institution_id", ctx.institutionId).order("created_at");
  if (!data || data.length === 0) {
    await db.from("org_join_links").insert({ institution_id: ctx.institutionId, code: newJoinCode(), label: "All students", created_by_membership_id: ctx.membershipId });
    ({ data } = await db.from("org_join_links").select("*").eq("institution_id", ctx.institutionId).order("created_at"));
  }
  const links = (data ?? []) as { id: string; code: string; label: string | null; branch: string | null; end_year: number | null; active: boolean }[];
  const { data: uses } = links.length ? await db.from("org_join_link_uses").select("join_link_id").in("join_link_id", links.map((l) => l.id)) : { data: [] };
  const count = (id: string) => ((uses ?? []) as { join_link_id: string }[]).filter((u) => u.join_link_id === id).length;
  return links.map((l) => ({ id: l.id, code: l.code, label: l.label, branch: l.branch, endYear: l.end_year, active: l.active, joined: count(l.id) }));
}
