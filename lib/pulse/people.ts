import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { untyped } from "@/lib/org/db";
import { kindOf } from "@/lib/org/roles";

type Service = SupabaseClient<Database>;

export interface PersonSummary {
  id: string;
  name: string | null;
  avatarUrl: string | null;
  /** "Amrita Sai Institute · CSE · Class of 2027" */
  headline: string | null;
  role: "student" | "faculty" | "staff" | null;
  /** an approved Capabilio mentor */
  isMentor?: boolean;
}

const ROLE_LABEL: Record<string, string> = { faculty: "Faculty", hod: "Head of Department", principal: "Principal", vice_principal: "Vice Principal", tpo: "Training & Placement" };

/** Pure. The one-line "who is this" shown under a name everywhere in Pulse. */
export function headlineOf(m: { role: string; institution: string | null; branch: string | null; endYear: number | null } | null): string | null {
  if (!m) return null;
  const parts = m.role === "student" ? [m.institution, m.branch, m.endYear ? `Class of ${m.endYear}` : null] : [ROLE_LABEL[m.role] ?? null, m.institution];
  const line = parts.filter(Boolean).join(" · ");
  return line || null;
}

interface MembershipRow {
  user_id: string;
  role: string;
  branch: string | null;
  end_year: number | null;
  institutions: { name: string } | null;
}

/** Name, avatar and headline for many people in two queries. Only public fields: never an email. */
export async function loadPeople(service: Service, ids: string[]): Promise<Map<string, PersonSummary>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();
  const [{ data: profiles }, { data: memberships }, { data: mentors }] = await Promise.all([
    service.from("profiles").select("id, full_name, avatar_url").in("id", unique),
    untyped(service).from("institution_memberships").select("user_id, role, branch, end_year, institutions ( name )").in("user_id", unique).eq("status", "active"),
    untyped(service).from("mentor_profiles").select("user_id").in("user_id", unique).eq("status", "approved"),
  ]);
  const mentorIds = new Set(((mentors ?? []) as { user_id: string }[]).map((m) => m.user_id));
  const membership = new Map<string, MembershipRow>();
  for (const m of (memberships ?? []) as unknown as MembershipRow[]) if (!membership.has(m.user_id) || m.role !== "student") membership.set(m.user_id, m);
  return new Map(
    (profiles ?? []).map((p) => {
      const m = membership.get(p.id) ?? null;
      const kind = m ? kindOf(m.role) : null;
      return [
        p.id,
        {
          id: p.id,
          name: p.full_name,
          avatarUrl: p.avatar_url,
          headline: headlineOf(m && { role: m.role, institution: m.institutions?.name ?? null, branch: m.branch, endYear: m.end_year }),
          isMentor: mentorIds.has(p.id),
          role: kind === "student" ? "student" : kind === "staff" ? "faculty" : kind ? "staff" : null,
        } satisfies PersonSummary,
      ];
    })
  );
}
