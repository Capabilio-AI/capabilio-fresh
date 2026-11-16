import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { untyped } from "@/lib/org/db";

const YEAR = /^[0-9]{4}$/;
const text = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

/**
 * The college and stream a student typed at sign-up are saved on the account, and the sign-up trigger turns them into a college
 * membership. If that membership is missing (the trigger could not finish, or the row was removed), the app would ask for details
 * the student already gave. This rebuilds it from what they entered: only when they have no membership at all, never over an existing
 * one, and only from their own sign-up details. Returns true when it created one.
 */
export async function ensureStudentMembership(service: SupabaseClient<Database>, userId: string): Promise<boolean> {
  const db = untyped(service);
  const { count } = await db.from("institution_memberships").select("id", { count: "exact", head: true }).eq("user_id", userId);
  if ((count ?? 0) > 0) return false;

  // read only when there is something to repair, so the common case costs one count
  const { data: account } = await service.auth.admin.getUserById(userId);
  const meta = (account?.user?.user_metadata ?? {}) as Record<string, unknown>;
  const college = text(meta.college_name, 200);
  if (!college) return false;

  const { data: institutionId, error: rpcError } = await db.rpc("get_or_create_institution", { institution_name: college });
  if (rpcError || typeof institutionId !== "string") return false;

  const start = typeof meta.start_year === "string" && YEAR.test(meta.start_year) ? Number(meta.start_year) : null;
  const end = typeof meta.end_year === "string" && YEAR.test(meta.end_year) ? Number(meta.end_year) : null;
  const years = start !== null && end !== null && end > start && end - start <= 8 ? { start_year: start, end_year: end } : { start_year: null, end_year: null };
  const { error } = await db.from("institution_memberships").insert({
    user_id: userId,
    institution_id: institutionId,
    role: "student",
    branch: text(meta.branch, 120),
    roll_number: text(meta.roll_number, 40),
    ...years,
  });
  return !error;
}
