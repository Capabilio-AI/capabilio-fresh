import { randomBytes } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/service";
import { adminDb, peopleByIds, rowsOf } from "./db";
import { audit } from "./audit";
import { isAdminRole, ROLE_LABEL, type AdminRole } from "./permissions";

export interface TeamMember {
  userId: string; name: string | null; email: string | null; role: AdminRole; hideContacts: boolean; addedAt: string | null; lastSignIn: string | null; mustChange: boolean;
}

export type TeamResult<T = object> = ({ ok: true } & T) | { ok: false; status: number; error: string };
const MISSING = "Apply migration 205 first: the admin list has no roles yet.";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Everyone who can open the console, with their role and when they last signed in. */
export async function listTeam(): Promise<{ members: TeamMember[]; rolesAvailable: boolean }> {
  const db = adminDb();
  let res = await db.from("platform_admins").select("user_id, role, hide_contacts, added_at");
  const rolesAvailable = !res.error;
  if (res.error) res = await db.from("platform_admins").select("user_id");
  const rows = rowsOf<{ user_id: string; role?: string; hide_contacts?: boolean; added_at?: string }>(res);
  const people = await peopleByIds(rows.map((r) => r.user_id));
  const svc = createServiceClient();
  const members = await Promise.all(rows.map(async (r) => {
    const { data } = await svc.auth.admin.getUserById(r.user_id);
    return { userId: r.user_id, name: people.get(r.user_id)?.name ?? null, email: people.get(r.user_id)?.email ?? data.user?.email ?? null, role: isAdminRole(r.role) ? r.role : "owner", hideContacts: Boolean(r.hide_contacts), addedAt: r.added_at ?? null, lastSignIn: data.user?.last_sign_in_at ?? null, mustChange: data.user?.user_metadata?.must_change_password === true } as TeamMember;
  }));
  return { members: members.sort((a, b) => (a.role === b.role ? (a.name ?? "").localeCompare(b.name ?? "") : a.role === "owner" ? -1 : 1)), rolesAvailable };
}

const ownerCount = async () => rowsOf<{ role: string }>(await adminDb().from("platform_admins").select("role").eq("role", "owner")).length;

/**
 * Gives someone access. An existing account is just added. A new email gets an account with a one-time password that is shown once to the owner
 * adding them and must be changed at first sign-in; nothing is emailed from here, so the owner passes it on themselves.
 */
export async function addAdmin(actorId: string, input: { email: string; role: AdminRole; hideContacts: boolean }): Promise<TeamResult<{ created: boolean; tempPassword?: string }>> {
  const email = input.email.trim().toLowerCase();
  if (!EMAIL.test(email)) return { ok: false, status: 400, error: "Enter a valid email address." };
  const db = adminDb();
  const svc = createServiceClient();
  // Checked before an account is created, so a missing migration never leaves a half-made admin behind.
  if ((await db.from("platform_admins").select("role", { count: "exact", head: true })).error) return { ok: false, status: 409, error: MISSING };
  const { data: existing } = await db.from("profiles").select("id").ilike("email", email).maybeSingle();
  let userId = (existing as { id: string } | null)?.id ?? null;
  let tempPassword: string | undefined;
  if (userId) {
    const { data: row } = await db.from("platform_admins").select("user_id").eq("user_id", userId).maybeSingle();
    if (row) return { ok: false, status: 409, error: "They are already an admin. Change their role in the list instead." };
  } else {
    tempPassword = randomBytes(12).toString("base64url") + "!7a";
    const { data, error } = await svc.auth.admin.createUser({ email, password: tempPassword, email_confirm: true, user_metadata: { full_name: email.split("@")[0], must_change_password: true } });
    if (error || !data.user) return { ok: false, status: 500, error: "Could not create that account. Try again." };
    userId = data.user.id;
  }
  const { error } = await db.from("platform_admins").upsert({ user_id: userId, role: input.role, hide_contacts: input.hideContacts, added_by: actorId }, { onConflict: "user_id" });
  if (error) return { ok: false, status: 500, error: error.code === "42703" ? MISSING : "Could not save. Try again." };
  await audit(actorId, "team.add", email, `${ROLE_LABEL[input.role]}${input.hideContacts ? ", contacts hidden" : ""}`);
  return { ok: true, created: Boolean(tempPassword), tempPassword };
}

export async function updateAdmin(actorId: string, userId: string, change: { role?: AdminRole; hideContacts?: boolean }): Promise<TeamResult> {
  if (userId === actorId) return { ok: false, status: 400, error: "You cannot change your own role. Ask another owner." };
  const db = adminDb();
  const { data: cur, error: readErr } = await db.from("platform_admins").select("user_id, role").eq("user_id", userId).maybeSingle();
  if (readErr) return { ok: false, status: 500, error: readErr.code === "42703" ? MISSING : "Could not read that admin." };
  if (!cur) return { ok: false, status: 404, error: "That person is not an admin." };
  if ((cur as { role: string }).role === "owner" && change.role && change.role !== "owner" && (await ownerCount()) <= 1) return { ok: false, status: 409, error: "There must always be at least one owner." };
  const patch: Record<string, unknown> = {};
  if (change.role) patch.role = change.role;
  if (change.hideContacts !== undefined) patch.hide_contacts = change.hideContacts;
  const { error } = await db.from("platform_admins").update(patch).eq("user_id", userId);
  if (error) return { ok: false, status: 500, error: "Could not save. Try again." };
  const who = (await peopleByIds([userId])).get(userId);
  await audit(actorId, "team.update", who?.email ?? userId, [change.role ? `role ${ROLE_LABEL[change.role]}` : "", change.hideContacts !== undefined ? (change.hideContacts ? "contacts hidden" : "contacts visible") : ""].filter(Boolean).join(", "));
  return { ok: true };
}

/** Takes console access away. It ends immediately: every page and action checks the admin list, so their next click is refused. The account itself stays. */
export async function removeAdmin(actorId: string, userId: string): Promise<TeamResult> {
  if (userId === actorId) return { ok: false, status: 400, error: "You cannot remove yourself. Ask another owner." };
  const db = adminDb();
  const { data: cur } = await db.from("platform_admins").select("user_id, role").eq("user_id", userId).maybeSingle();
  if (!cur) return { ok: false, status: 404, error: "That person is not an admin." };
  if ((cur as { role?: string }).role === "owner" && (await ownerCount()) <= 1) return { ok: false, status: 409, error: "There must always be at least one owner." };
  const { error } = await db.from("platform_admins").delete().eq("user_id", userId);
  if (error) return { ok: false, status: 500, error: "Could not remove them. Try again." };
  const who = (await peopleByIds([userId])).get(userId);
  await audit(actorId, "team.remove", who?.email ?? userId, null);
  return { ok: true };
}
