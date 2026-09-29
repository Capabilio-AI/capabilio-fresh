import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/lib/supabase/types";

export type OpportunityType = "job" | "internship" | "competition" | "referral";

export interface Opportunity {
  id: string;
  role: string;
  company: string;
  location: string | null;
  type: OpportunityType;
  skills: string[];
  eligibility: string | null;
  deadline: string | null;
  /** A placement drive posted by the student's own college (RLS only returns it to that college's active members). */
  campus: boolean;
}

const TYPES: OpportunityType[] = ["job", "internship", "competition", "referral"];
const SkillsSchema = z.array(z.string());

/** Pure: an open listing has no deadline, or a deadline today or later (`today` is YYYY-MM-DD). */
export function isOpen(deadline: string | null, today: string): boolean {
  return deadline == null || deadline >= today;
}

/** Real rows only. An empty table yields an empty list — the page shows an honest empty state, never sample data. */
export async function listOpenOpportunities(supabase: SupabaseClient<Database>, now: Date = new Date()): Promise<Opportunity[]> {
  const today = now.toISOString().slice(0, 10);
  const { data } = await supabase
    .from("opportunities")
    .select("id, role, company, location, opportunity_type, skills, eligibility, deadline, institution_id")
    .order("deadline", { ascending: true, nullsFirst: false });
  return (data ?? [])
    .filter((r) => isOpen(r.deadline, today) && (TYPES as string[]).includes(r.opportunity_type))
    .map((r) => ({
      id: r.id,
      role: r.role,
      company: r.company,
      location: r.location,
      type: r.opportunity_type as OpportunityType,
      skills: SkillsSchema.safeParse(r.skills).data ?? [],
      eligibility: r.eligibility,
      deadline: r.deadline,
      campus: r.institution_id !== null,
    }));
}
