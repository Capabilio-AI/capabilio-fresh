import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { getStudentDirection } from "./direction";
import { validateProgramYears } from "./years";

export type WriteResult = { ok: true } | { ok: false; status: number; message: string };

/**
 * Student-declared program years (validated) and the manual current-year
 * override. Always resolves the membership from the authenticated user id, so
 * a caller can only ever change their own row. `service` bypasses RLS on
 * purpose: institution_memberships has no UPDATE policy for clients.
 */
export async function saveProgramYears(
  service: SupabaseClient<Database>,
  userId: string,
  input: { startYear: number; endYear: number; currentYearOverride: number | null },
  now: Date = new Date()
): Promise<WriteResult> {
  const years = validateProgramYears(input.startYear, input.endYear, now);
  if (!years.ok) return { ok: false, status: 400, message: years.message };
  const direction = await getStudentDirection(service, userId, now);
  if (!direction) return { ok: false, status: 404, message: "No student program found for your account." };
  const { error } = await service
    .from("institution_memberships")
    .update({
      start_year: years.startYear,
      end_year: years.endYear,
      year_override: input.currentYearOverride,
      year_confirmed_at: now.toISOString(),
    })
    .eq("id", direction.membershipId)
    .eq("user_id", userId);
  if (error) return { ok: false, status: 500, message: "Could not save — try again." };
  return { ok: true };
}
