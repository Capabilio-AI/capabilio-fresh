import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { getStudentDirection } from "@/lib/career/direction";

export const PLAN_B_CLOSED_MESSAGE = "Plan B opens in your 3rd year, 1st semester (3-1) — it isn't available before or after.";

/** Plan B choices and its baseline questions are offered only in the student's 3-1 term (lib/career/term.ts). */
export async function isPlanBOpen(service: SupabaseClient<Database>, userId: string): Promise<boolean> {
  return (await getStudentDirection(service, userId))?.planBOpen ?? false;
}
