import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { getStudentDirection, type StudentDirection } from "@/lib/career/direction";
import { SECTION_ORDER, type AssessmentSection } from "./sections";

export type AssessmentMode = "full" | "light";

/** Communication + Career Interest only (architecture doc §5.4). */
export const LIGHT_SECTIONS: AssessmentSection[] = ["verbal_communication", "career_interests"];

export function sectionsForMode(mode: AssessmentMode): AssessmentSection[] {
  return mode === "light" ? LIGHT_SECTIONS : SECTION_ORDER;
}

/**
 * Server-chosen mode. The only input is the student's own membership, read
 * server-side, and the shared trigger result already on `direction`
 * (lib/career/trigger.ts) — never anything the client sends.
 */
export function assessmentModeFor(direction: Pick<StudentDirection, "inDirectionWindow"> | null): AssessmentMode {
  return direction?.inDirectionWindow ? "light" : "full";
}

export async function getAssessmentMode(supabase: SupabaseClient<Database>, userId: string): Promise<AssessmentMode> {
  return assessmentModeFor(await getStudentDirection(supabase, userId));
}
