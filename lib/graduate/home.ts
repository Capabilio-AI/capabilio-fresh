import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { untyped } from "@/lib/org/db";
import { createServiceClient } from "@/lib/supabase/service";
import { getCareerProfile } from "@/lib/assess/career-profile";
import type { Db as AssessDb } from "@/lib/assess/db";
import { buildOverview, type Overview } from "@/lib/dashboard/overview";
import { listOpenOpportunities, type Opportunity } from "@/lib/launchpad/opportunities";
import { buildPipeline, type PipelineStep } from "./pipeline";
import { loadPassportSkills } from "@/lib/passport/data";

export interface GraduateHomeData {
  firstName: string | null;
  overview: Overview | null;
  resume: { skillCount: number; applied: boolean } | null;
  /** the Skill Passport: how many skill badges are earned and whether the public link is switched on */
  passport: { earned: number; total: number; shared: boolean };
  proofCount: number;
  interviewCount: number;
  applicationCount: number;
  opportunities: Opportunity[];
  steps: PipelineStep[];
}

const TOP_LISTINGS = 3;

export async function loadGraduateHome(supabase: SupabaseClient<Database>, userId: string, fullName: string | null): Promise<GraduateHomeData> {
  const service = untyped(createServiceClient());
  const [profile, opportunities, vault, resume, interviews, applications, passport, me] = await Promise.all([
    getCareerProfile(createServiceClient() as unknown as AssessDb, userId),
    listOpenOpportunities(supabase),
    service.from("vault_items").select("id", { count: "exact", head: true }).eq("user_id", userId),
    service.from("graduate_resumes").select("skill_names, applied_at").eq("user_id", userId).maybeSingle(),
    service.from("ai_interview_sessions").select("id", { count: "exact", head: true }).eq("user_id", userId).not("completed_at", "is", null),
    supabase.from("applications").select("id", { count: "exact", head: true }).eq("user_id", userId),
    loadPassportSkills(createServiceClient() as unknown as AssessDb, userId),
    service.from("profiles").select("passport_public").eq("id", userId).maybeSingle(),
  ]);

  const overview = buildOverview(profile);
  const proofCount = vault.count ?? 0;
  const interviewCount = interviews.count ?? 0;
  const applicationCount = applications.count ?? 0;
  const resumeRow = resume.data as { skill_names: string[] | null; applied_at: string | null } | null;

  return {
    firstName: fullName?.trim().split(/\s+/)[0] ?? null,
    overview,
    resume: resumeRow ? { skillCount: resumeRow.skill_names?.length ?? 0, applied: Boolean(resumeRow.applied_at) } : null,
    passport: { earned: passport.skills.filter((s) => s.badge).length, total: passport.skills.length, shared: Boolean((me.data as { passport_public: boolean | null } | null)?.passport_public) },
    proofCount,
    interviewCount,
    applicationCount,
    opportunities: opportunities.slice(0, TOP_LISTINGS),
    steps: buildPipeline({ hasLevel: overview !== null, proofCount, interviewCount, applicationCount }),
  };
}
