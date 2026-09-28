import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export interface EducationEntry {
  id: string;
  institutionName: string;
  collegeType: string | null;
  city: string | null;
  state: string | null;
  branch: string | null;
  year: string | null;
  memberSince: string;
  hasVerifiedCertificate: boolean;
}

export interface EducationTimelineEvent {
  kind: "enrolled" | "certificate";
  label: string;
  date: string;
}

interface MembershipRow {
  id: string;
  branch: string | null;
  year: string | null;
  created_at: string;
  institutions: { name: string; college_type: string; city: string | null; state: string | null } | null;
}

/**
 * Every institution a student has added — real, multi-entry (a previous
 * school plus a current college, same as LinkedIn's Education section).
 * institution_memberships already allowed multiple rows per user at the DB
 * level (unique on user_id+institution_id, never on user_id alone); only
 * the application layer used to assume a single row. Ordered newest-added
 * first — there's no separate "attended from/to" date in this schema, only
 * when the record was added to Capabilio.
 */
export async function getEducationEntries(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<EducationEntry[]> {
  const [{ data: memberships }, { data: verifiedCerts }] = await Promise.all([
    supabase
      .from("institution_memberships")
      .select("id, branch, year, created_at, institutions ( name, college_type, city, state )")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
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
      branch: m.branch,
      year: m.year,
      memberSince: m.created_at,
      hasVerifiedCertificate: verifiedMembershipIds.has(m.id),
    }));
}

/** Pure educational timeline: enrollments plus certificates added to the Vault. */
export async function getEducationTimeline(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<EducationTimelineEvent[]> {
  const [{ data: memberships }, { data: certificates }] = await Promise.all([
    supabase
      .from("institution_memberships")
      .select("created_at, institutions ( name )")
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
    events.push({
      kind: "enrolled",
      label: institution ? `Enrolled at ${institution.name}` : "Enrolled",
      date: m.created_at,
    });
  }
  for (const cert of certificates ?? []) {
    events.push({ kind: "certificate", label: `Certificate added: ${cert.title}`, date: cert.created_at });
  }
  return events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}
