import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { kindOf, type OrgKind } from "./roles";

export interface OrgContext {
  userId: string;
  membershipId: string;
  institutionId: string;
  institutionName: string;
  institutionSlug: string;
  role: string;
  kind: OrgKind;
  branch: string | null;
}

/**
 * The caller's org context, derived ONLY from their own ACTIVE membership (read as the user, under RLS) —
 * never from a request field. A pending or rejected member has no context at all.
 */
export async function getOrgContext(supabase: SupabaseClient<Database>, userId: string): Promise<OrgContext | null> {
  const { data } = await supabase
    .from("institution_memberships")
    .select("id, institution_id, role, branch, institutions ( name, slug )")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false });
  for (const m of data ?? []) {
    const kind = kindOf(m.role);
    const inst = m.institutions as { name: string; slug: string } | null;
    if (kind && inst) {
      return {
        userId,
        membershipId: m.id,
        institutionId: m.institution_id,
        institutionName: inst.name,
        institutionSlug: inst.slug,
        role: m.role,
        kind,
        branch: m.branch,
      };
    }
  }
  return null;
}
