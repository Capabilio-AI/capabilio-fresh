import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { getAssessmentMode, sectionsForMode } from "./mode";
import type { AssessmentSection } from "./sections";

/** Null when the section belongs to the student's server-decided assessment; otherwise a 403 to return as-is. */
export async function rejectSectionOutsideMode(
  supabase: SupabaseClient<Database>,
  userId: string,
  section: AssessmentSection
): Promise<NextResponse | null> {
  const mode = await getAssessmentMode(supabase, userId);
  if (sectionsForMode(mode).includes(section)) return null;
  return NextResponse.json({ error: "This section is not part of your assessment." }, { status: 403 });
}
