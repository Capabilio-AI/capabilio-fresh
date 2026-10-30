import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/lib/supabase/types";
import { untyped } from "@/lib/org/db";

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
  /** A company visit recorded by the student's own college (RLS only returns it to that college's active members). */
  campus: boolean;
  driveDate: string | null;
  /** planned = announced but registration not open yet */
  driveStatus: "planned" | "registration_open";
  ctcOffered: string | null;
  eligibleBranches: string[];
}

const TYPES: OpportunityType[] = ["job", "internship", "competition", "referral"];
const OPEN_LIMIT = 200;
const SkillsSchema = z.array(z.string());

/** Pure: an open listing has no deadline, or a deadline today or later (`today` is YYYY-MM-DD). */
export function isOpen(deadline: string | null, today: string): boolean {
  return deadline == null || deadline >= today;
}

/** Real rows only (`onlyId` narrows to one listing). An empty table yields an empty list — the page shows an honest empty state, never sample data. */
export async function listOpenOpportunities(supabase: SupabaseClient<Database>, now: Date = new Date(), onlyId?: string): Promise<Opportunity[]> {
  // Deadlines are calendar dates in India, so "today" is the IST date (en-CA formats as YYYY-MM-DD).
  const today = now.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  // untyped: the company-visit columns postdate the generated types
  let query = untyped(supabase)
    .from("opportunities")
    .select("id, role, company, location, opportunity_type, skills, eligibility, deadline, institution_id, drive_date, drive_status, ctc_offered, eligible_branches")
    // filtered in SQL: still open, a type we render, and a company visit that is not completed or cancelled
    .or(`deadline.is.null,deadline.gte.${today}`)
    .in("opportunity_type", TYPES)
    .in("drive_status", ["planned", "registration_open"])
    .order("deadline", { ascending: true, nullsFirst: false })
    .limit(OPEN_LIMIT);
  if (onlyId) query = query.eq("id", onlyId);
  const { data } = await query;
  type Row = {
    id: string;
    role: string;
    company: string;
    location: string | null;
    opportunity_type: string;
    skills: unknown;
    eligibility: string | null;
    deadline: string | null;
    institution_id: string | null;
    drive_date: string | null;
    drive_status: "planned" | "registration_open";
    ctc_offered: string | null;
    eligible_branches: string[] | null;
  };
  return ((data ?? []) as Row[])
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
      driveDate: r.drive_date,
      driveStatus: r.drive_status,
      ctcOffered: r.ctc_offered,
      eligibleBranches: r.eligible_branches ?? [],
    }));
}
