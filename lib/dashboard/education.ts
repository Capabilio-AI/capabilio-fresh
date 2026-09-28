import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export interface EducationEntry {
  id: string;
  institutionName: string;
  collegeType: string | null;
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

export interface EducationTimelineEvent {
  kind: "enrolled" | "certificate";
  label: string;
  /** Human-readable — a bare year ("2015") for entries whose only known date is start_year, a full date for real timestamps (certificate uploads). */
  displayDate: string;
  /** Sort key only — never shown as-is (would misrepresent an entry's real start_year as a fabricated day/month). */
  sortDate: string;
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
  institutions: { name: string; college_type: string; city: string | null; state: string | null } | null;
}

function entrySortYear(e: Pick<EducationEntry, "endYear" | "startYear" | "memberSince">): number {
  return e.endYear ?? e.startYear ?? new Date(e.memberSince).getFullYear();
}

/**
 * Every institution a student has added — real, multi-entry (schooling,
 * Intermediate, B.Tech, a later M.Tech — same as LinkedIn's Education
 * section). institution_memberships already allowed multiple rows per user
 * at the DB level (unique on user_id+institution_id, never on user_id
 * alone); only the application layer used to assume a single row.
 * Ordered by the most recent stage of education first (end year, or start
 * year for an ongoing entry, or when it was added as a last resort — never
 * by when the row happened to be added to Capabilio, which could put a
 * just-added "10th" entry ahead of a years-earlier-added B.Tech one).
 */
export async function getEducationEntries(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<EducationEntry[]> {
  const [{ data: memberships }, { data: verifiedCerts }] = await Promise.all([
    supabase
      .from("institution_memberships")
      .select(
        "id, branch, year, degree, field_of_study, start_year, end_year, created_at, institutions ( name, college_type, city, state )"
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

  return ((memberships as MembershipRow[] | null) ?? [])
    .filter((m): m is MembershipRow & { institutions: NonNullable<MembershipRow["institutions"]> } =>
      Boolean(m.institutions)
    )
    .map((m) => ({
      id: m.id,
      institutionName: m.institutions.name,
      collegeType: m.institutions.college_type,
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
    }))
    .sort((a, b) => entrySortYear(b) - entrySortYear(a) || new Date(b.memberSince).getTime() - new Date(a.memberSince).getTime());
}

/**
 * Pure educational timeline: enrollments plus certificates added to the
 * Vault, in real chronological order. Enrollment events are anchored to
 * the entry's own start_year, not when it was added to Capabilio — a
 * student entering their 10th/Intermediate/B.Tech history in one sitting
 * today must not have all three "Enrolled" events pile up on today's date.
 */
export async function getEducationTimeline(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<EducationTimelineEvent[]> {
  const [{ data: memberships }, { data: certificates }] = await Promise.all([
    supabase
      .from("institution_memberships")
      .select("created_at, start_year, institutions ( name )")
      .eq("user_id", userId),
    supabase
      .from("vault_items")
      .select("title, created_at")
      .eq("user_id", userId)
      .eq("item_type", "certificate")
      .order("created_at", { ascending: true }),
  ]);

  const events: EducationTimelineEvent[] = [];
  for (const m of memberships ?? []) {
    const institution = m.institutions as { name: string } | null;
    const label = institution ? `Enrolled at ${institution.name}` : "Enrolled";
    if (m.start_year) {
      events.push({ kind: "enrolled", label, displayDate: String(m.start_year), sortDate: `${m.start_year}-01-01` });
    } else {
      events.push({
        kind: "enrolled",
        label,
        displayDate: new Date(m.created_at).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
        }),
        sortDate: m.created_at,
      });
    }
  }
  for (const cert of certificates ?? []) {
    events.push({
      kind: "certificate",
      label: `Certificate added: ${cert.title}`,
      displayDate: new Date(cert.created_at).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
      sortDate: cert.created_at,
    });
  }
  return events.sort((a, b) => new Date(a.sortDate).getTime() - new Date(b.sortDate).getTime());
}
