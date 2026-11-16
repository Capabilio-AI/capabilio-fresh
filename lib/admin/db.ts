import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import { untyped } from "@/lib/org/db";
import { getAuthedUser } from "@/lib/supabase/auth";
import { can, isAdminRole, type AdminLimits, type AdminRole, type Permission } from "./permissions";

/** The service-role client, untyped: the admin portal reads across every table, and only after the admin check below. */
export const adminDb = () => untyped(createServiceClient());

export const HEAD = { count: "exact" as const, head: true };

export interface Admin extends AdminLimits {
  userId: string;
  email: string | null;
  /** an account created for them by an owner: they must choose their own password before anything else */
  mustChangePassword: boolean;
}

/** The admin row for a user, or null if they are not an admin. Works before migration 205 (no role column yet): everyone is then an owner. */
export async function loadAdmin(userId: string, email: string | null): Promise<Admin | null> {
  const db = adminDb();
  let role: AdminRole = "owner";
  let hideContacts = false;
  const res = await db.from("platform_admins").select("user_id, role, hide_contacts").eq("user_id", userId).maybeSingle();
  if (res.error) {
    const plain = await db.from("platform_admins").select("user_id").eq("user_id", userId).maybeSingle();
    if (plain.error || !plain.data) return null;
  } else {
    if (!res.data) return null;
    const row = res.data as { role: string | null; hide_contacts: boolean | null };
    role = isAdminRole(row.role) ? row.role : "owner";
    hideContacts = Boolean(row.hide_contacts);
  }
  const { data } = await createServiceClient().auth.admin.getUserById(userId);
  return { userId, email, role, hideContacts, mustChangePassword: data.user?.user_metadata?.must_change_password === true };
}

/**
 * Page guard. Only a Capabilio admin gets in (anyone else goes to the console's sign-in), an admin who still has an owner-issued password must
 * change it first, and `needs` (any one of these permissions) decides whether this admin's role may see the page at all.
 */
export async function requireAdminPage(needs?: Permission | readonly Permission[], opts: { allowMustChange?: boolean } = {}): Promise<Admin> {
  const { user } = await getAuthedUser();
  const admin = user ? await loadAdmin(user.id, user.email ?? null) : null;
  if (!admin) redirect("/admin/login");
  if (admin.mustChangePassword && !opts.allowMustChange) redirect("/admin/account?change=1");
  if (needs) {
    const list = Array.isArray(needs) ? needs : [needs as Permission];
    if (!list.some((p) => can(admin, p))) redirect("/admin/no-access");
  }
  return admin;
}

/** Runs a read and returns the fallback if it fails, so one missing table never blanks a whole page. */
export async function safe<T>(read: PromiseLike<T> | (() => PromiseLike<T>), fallback: T, label = "admin"): Promise<T> {
  try {
    return await (typeof read === "function" ? read() : read);
  } catch (e) {
    console.error(`[${label}] read failed:`, e instanceof Error ? e.message : e);
    return fallback;
  }
}

/** The rows of a PostgREST response, or [] when it errored (a table that does not exist yet, for instance). */
export const rowsOf = <T>(r: { data: unknown; error?: unknown }): T[] => (r.error ? [] : ((r.data ?? []) as T[]));
export const countOf = (r: { count: number | null; error?: unknown }): number => (r.error ? 0 : (r.count ?? 0));

export const chunk = <T,>(xs: readonly T[], n = 200): T[][] => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

/** Names and emails for a set of user ids. */
export async function peopleByIds(ids: readonly string[]): Promise<Map<string, { id: string; name: string | null; email: string | null; status: string | null; createdAt: string }>> {
  const out = new Map<string, { id: string; name: string | null; email: string | null; status: string | null; createdAt: string }>();
  const db = adminDb();
  for (const part of chunk([...new Set(ids)])) {
    const { data } = await db.from("profiles").select("id, full_name, email, student_status, created_at").in("id", part);
    for (const p of (data ?? []) as { id: string; full_name: string | null; email: string | null; student_status: string | null; created_at: string }[]) out.set(p.id, { id: p.id, name: p.full_name, email: p.email, status: p.student_status, createdAt: p.created_at });
  }
  return out;
}
