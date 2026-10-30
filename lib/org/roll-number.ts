import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/lib/supabase/types";

export const GRACE_DAYS = 7;
export const RollNumberSchema = z
  .object({ rollNumber: z.string().trim().toUpperCase().regex(/^[A-Z0-9][A-Z0-9/_-]{3,29}$/, "Enter your roll number exactly as your college issued it.") })
  .strict();

export interface RollNumberNotice {
  collegeName: string;
  /** missing: add one before dueAt; mismatch: entered, but doesn't carry the college's code */
  kind: "missing" | "mismatch";
  /** what is currently saved, when anything is */
  rollNumber: string | null;
  dueAt: string | null;
}

/** What the student must fix, if anything — read from the database's own check, never recomputed here. */
export async function loadRollNumberNotice(service: SupabaseClient<Database>, userId: string): Promise<RollNumberNotice | null> {
  const { data } = await service
    .from("institution_memberships")
    .select("roll_number, roll_number_status, roll_number_due_at, institutions ( name )")
    .eq("user_id", userId)
    .eq("role", "student")
    .not("branch", "is", null)
    .eq("roll_number_status", "flagged")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const inst = data.institutions as { name: string } | null;
  return { collegeName: inst?.name ?? "your college", kind: data.roll_number ? "mismatch" : "missing", rollNumber: data.roll_number, dueAt: data.roll_number_due_at };
}

export const BULK_FLAG_SHARE = 0.25;
export const BULK_FLAG_COUNT = 20;

/**
 * Pure. Circuit breaker for the roll-number cleanup: a college with more than a quarter of its students flagged (or
 * more than 20 at once) almost always means a code or config change went wrong, not that many bad roll numbers, so
 * its accounts are left alone this run for a human to look at.
 */
export function isBulkFlag(flagged: number, totalStudents: number): boolean {
  return flagged > BULK_FLAG_COUNT || (totalStudents > 0 && flagged / totalStudents > BULK_FLAG_SHARE);
}
