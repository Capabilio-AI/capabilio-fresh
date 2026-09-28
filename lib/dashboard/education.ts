import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export interface EducationHistory {
  institutionName: string | null;
  collegeType: string | null;
  city: string | null;
  state: string | null;
  branch: string | null;
  year: string | null;
  memberSince: string | null;
  hasVerifiedCertificate: boolean;
}

export interface EducationTimelineEvent {
  kind: "enrolled" | "certificate";
  label: string;
  date: string;
}

interface MembershipEmbed {
  branch: string | null;
  year: string | null;
  created_at: string;
  institutions: { name: string; college_type: string; city: string | null; state: string | null } | null;
}

/**
 * The student's real institutional record — not a fabricated multi-school
 * history (no such data exists). Only branch/year/institution are ever
 * populated in production; program/department/cohort are a separate,
 * unpopulated schema (Journey Engine work) and are deliberately not
 * surfaced here.
 */
export async function getEducationHistory(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<EducationHistory> {
  const [{ data: membership }, { data: verifiedCert }] = await Promise.all([
    supabase
      .from("institution_memberships")
      .select("branch, year, created_at, institutions ( name, college_type, city, state )")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("vault_items")
      .select("id")
      .eq("user_id", userId)
      .eq("item_type", "certificate")
      .eq("verified", true)
      .limit(1)
      .maybeSingle(),
  ]);

  const m = membership as MembershipEmbed | null;
  const institution = m?.institutions ?? null;

  return {
    institutionName: institution?.name ?? null,
    collegeType: institution?.college_type ?? null,
    city: institution?.city ?? null,
    state: institution?.state ?? null,
    branch: m?.branch ?? null,
    year: m?.year ?? null,
    memberSince: m?.created_at ?? null,
    hasVerifiedCertificate: Boolean(verifiedCert),
  };
}

/** Pure educational timeline: enrollment plus certificates added to the Vault. */
export async function getEducationTimeline(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<EducationTimelineEvent[]> {
  const [{ data: membership }, { data: certificates }] = await Promise.all([
    supabase.from("institution_memberships").select("created_at").eq("user_id", userId).maybeSingle(),
    supabase
      .from("vault_items")
      .select("title, created_at")
      .eq("user_id", userId)
      .eq("item_type", "certificate")
      .order("created_at", { ascending: true }),
  ]);

  const events: EducationTimelineEvent[] = [];
  if (membership?.created_at) {
    events.push({ kind: "enrolled", label: "Enrolled", date: membership.created_at });
  }
  for (const cert of certificates ?? []) {
    events.push({ kind: "certificate", label: `Certificate added: ${cert.title}`, date: cert.created_at });
  }
  return events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}
