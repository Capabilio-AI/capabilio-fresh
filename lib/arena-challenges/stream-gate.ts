import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { getStudentDirection } from "@/lib/career/direction";
import { isStreamTerm } from "@/lib/career/term";

/** Stream challenges open at 2-1. Reads the student's year from the same direction record Plan B uses. */
export async function loadStreamGate(service: SupabaseClient<Database>, userId: string): Promise<{ open: boolean; year: number | null }> {
  const year = (await getStudentDirection(service, userId))?.academicYear?.year ?? null;
  return { open: isStreamTerm(year), year };
}
