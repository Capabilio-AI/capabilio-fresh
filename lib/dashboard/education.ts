import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export interface EducationEntry {
  id: string;
  institutionName: string;
  city: string | null;
  state: string | null;
  degree: string | null;
  fieldOfStudy: string | null;
  startYear: number | null;
  endYear: number | null;
  /** Legacy fields from the signup trigger — used only as a display fallback until an entry is edited into the degree/fieldOfStudy shape. */
  branch: string | null;
  year: string | null;
  memberSince: string;
  hasVerifiedCertificate: boolean;
}

interface MembershipRow {
  id: string;
  branch: string | null;
  year: string | null;
  degree: string | null;
  field_of_study: string | null;
  start_year: number | null;
  end_year: number | null;
  created_at: string;
  institutions: { name: string; city: string | null; state: string | null } | null;
}

// An entry with a start_year but no end_year is ongoing — it must rank as
// the MOST recent stage of education, not tie with (or lose to) a
// different, already-finished entry that happens to end the same year it
// started. Only when neither year is known at all does creation time serve
// as a last-resort placement.
function entrySortYear(e: Pick<EducationEntry, "endYear" | "startYear" | "memberSince">): number {
  if (e.endYear) return e.endYear;
  if (e.startYear) return Number.MAX_SAFE_INTEGER;
  return new Date(e.memberSince).getFullYear();
}

/** Pure, exported for testing — most recent stage of education first. */
export function sortEducationEntries<T extends Pick<EducationEntry, "endYear" | "startYear" | "memberSince">>(
  entries: T[]
): T[] {
  return [...entries].sort(
    (a, b) => entrySortYear(b) - entrySortYear(a) || new Date(b.memberSince).getTime() - new Date(a.memberSince).getTime()
  );
}

/**
 * Every institution a student has added — real, multi-entry (schooling,
 * Intermediate, B.Tech, a later M.Tech — same as LinkedIn's Education
 * section). institution_memberships already allowed multiple rows per user
 * at the DB level (unique on user_id+institution_id, never on user_id
 * alone); only the application layer used to assume a single row.
 * Ordered by the most recent stage of education first (end year, or
 * "ongoing" ranking above any finished entry, or when it was added as a
 * last resort — never by when the row happened to be added to Capabilio,
 * which could put a just-added "10th" entry ahead of a years-earlier-added
 * B.Tech one).
 */
export async function getEducationEntries(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<EducationEntry[]> {
  const [{ data: memberships }, { data: verifiedCerts }] = await Promise.all([
    supabase
      .from("institution_memberships")
      .select(
        "id, branch, year, degree, field_of_study, start_year, end_year, created_at, institutions ( name, city, state )"
      )
      .eq("user_id", userId),
    supabase
      .from("vault_items")
      .select("institution_membership_id")
      .eq("user_id", userId)
      .eq("item_type", "certificate")
      .eq("verified", true)
      .not("institution_membership_id", "is", null),
  ]);

  const verifiedMembershipIds = new Set((verifiedCerts ?? []).map((c) => c.institution_membership_id));

  const entries = ((memberships as MembershipRow[] | null) ?? [])
    .filter((m): m is MembershipRow & { institutions: NonNullable<MembershipRow["institutions"]> } =>
      Boolean(m.institutions)
    )
    .map((m) => ({
      id: m.id,
      institutionName: m.institutions.name,
      city: m.institutions.city,
      state: m.institutions.state,
      degree: m.degree,
      fieldOfStudy: m.field_of_study,
      startYear: m.start_year,
      endYear: m.end_year,
      branch: m.branch,
      year: m.year,
      memberSince: m.created_at,
      hasVerifiedCertificate: verifiedMembershipIds.has(m.id),
    }));

  return sortEducationEntries(entries);
}
