import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { getStudentDirection } from "@/lib/career/direction";

/** Years of study in which choosing a role can wait: 1st and 2nd year may take the common assessment alone. */
export const ROLE_SKIPPABLE_UNTIL_YEAR = 2;

/** An unknown year (no college record yet) may skip too; a known 3rd or 4th year may not. */
export const isRoleSkippableYear = (year: number | null | undefined) => year == null || year <= ROLE_SKIPPABLE_UNTIL_YEAR;

/** Whether this student's year lets them skip choosing a role. */
export async function canSkipRole(service: SupabaseClient<Database>, userId: string): Promise<boolean> {
  return isRoleSkippableYear((await getStudentDirection(service, userId))?.academicYear?.year);
}

/** The student's current year of study, or null when their college record is missing. */
export async function studentYear(service: SupabaseClient<Database>, userId: string): Promise<number | null> {
  return (await getStudentDirection(service, userId))?.academicYear?.year ?? null;
}
