import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { getStudentDirection } from "@/lib/career/direction";

export const PLAN_B_CLOSED_MESSAGE = "Plan B opens when you reach 3rd year.";

/** Plan B choices and its baseline questions are offered from the student's 3rd year onward (lib/career/term.ts). */
export async function isPlanBOpen(service: SupabaseClient<Database>, userId: string): Promise<boolean> {
  return (await getStudentDirection(service, userId))?.planBOpen ?? false;
}
