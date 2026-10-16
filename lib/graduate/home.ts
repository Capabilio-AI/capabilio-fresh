import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { untyped } from "@/lib/org/db";
import { createServiceClient } from "@/lib/supabase/service";
import { getCareerProfile } from "@/lib/assess/career-profile";
import type { Db as AssessDb } from "@/lib/assess/db";
import { buildOverview, type Overview } from "@/lib/dashboard/overview";
import { listOpenOpportunities } from "@/lib/launchpad/opportunities";
import { matchJob } from "@/lib/launchpad/match";
import { loadSkillContext } from "@/lib/arena/skill-context";
import type { PassportSkill } from "@/lib/passport/badges";
import { loadPassportSkills } from "@/lib/passport/data";
import { buildPipeline, type PipelineStep } from "./pipeline";
import { nextMove, type Move, type TopRole } from "./next-move";
import { pickTarget } from "./pick-target";

export interface BestFitRole {
  id: string;
  role: string;
  company: string;
  location: string | null;
  /** null when no listed skill can be compared with the catalog */
  percent: number | null;
  measured: number;
  counted: number;
  /** the weakest skills for this role, by name */
  gaps: string[];
}

export interface GraduateHomeData {
  firstName: string | null;
  overview: Overview | null;
  resume: { skillCount: number; applied: boolean } | null;
  roleName: string | null;
  /** what the work has proven, kept apart from the starting point the assessment gave */
  proof: {
    skills: PassportSkill[];
    earned: number;
    practising: number;
    total: number;
    arenaPasses: number;
    /** the Arena rating, only once Arena work has moved it */
    rating: number | null;
  };
  passport: { earned: number; total: number; shared: boolean };
  vaultCount: number;
  interviewCount: number;
  applicationCount: number;
  applications: { submitted: number; shortlisted: number; accepted: number; rejected: number };
  roles: BestFitRole[];
  move: Move;
  steps: PipelineStep[];
}

const SHOWN_ROLES = 3;
const CONSIDERED = 24;

export async function loadGraduateHome(supabase: SupabaseClient<Database>, userId: string, fullName: string | null, interviewUnlocked: boolean): Promise<GraduateHomeData> {
  const service = createServiceClient();
  const db = untyped(service);
  const [profile, opportunities, vault, resume, interviews, applications, passport, me, context] = await Promise.all([
    getCareerProfile(service as unknown as AssessDb, userId),
    listOpenOpportunities(supabase),
    db.from("vault_items").select("id", { count: "exact", head: true }).eq("user_id", userId),
    db.from("graduate_resumes").select("skill_names, applied_at").eq("user_id", userId).maybeSingle(),
    db.from("ai_interview_sessions").select("id", { count: "exact", head: true }).eq("user_id", userId).not("completed_at", "is", null),
    supabase.from("applications").select("status").eq("user_id", userId),
    loadPassportSkills(service, userId),
    db.from("profiles").select("passport_public").eq("id", userId).maybeSingle(),
    loadSkillContext(service, userId),
  ]);

  const overview = buildOverview(profile);
  const resumeRow = resume.data as { skill_names: string[] | null; applied_at: string | null } | null;
  const count = (status: string) => (applications.data ?? []).filter((a) => a.status === status).length;
  const apps = { submitted: count("submitted"), shortlisted: count("shortlisted"), accepted: count("accepted"), rejected: count("rejected") };
  const applicationCount = (applications.data ?? []).length;

  const roles: BestFitRole[] = opportunities
    .filter((o) => o.type === "job" || o.type === "internship")
    .slice(0, CONSIDERED)
    .map((o) => {
      const m = matchJob(o.skills, context.resolve, context.levelOf);
      return { id: o.id, role: o.role, company: o.company, location: o.location, percent: m.percent, measured: m.measured, counted: m.counted, gaps: m.gaps.slice(0, 2).map((g) => context.names.get(g.skillId ?? "") ?? g.text) };
    })
    .sort((a, b) => (b.percent ?? -1) - (a.percent ?? -1))
    .slice(0, SHOWN_ROLES);

  const earned = passport.skills.filter((s) => s.badge).length;
  const arenaPasses = passport.skills.reduce((n, s) => n + s.evidence.filter((e) => e.kind === "ARENA").length, 0);
  const target = pickTarget(passport.skills, (id) => context.practisable.get(id)?.areaKey ?? null);
  const top: TopRole | null = roles[0] ? { id: roles[0].id, role: roles[0].role, company: roles[0].company, percent: roles[0].percent } : null;
  const interviewCount = interviews.count ?? 0;

  return {
    firstName: fullName?.trim().split(/\s+/)[0] ?? null,
    overview,
    resume: resumeRow ? { skillCount: resumeRow.skill_names?.length ?? 0, applied: Boolean(resumeRow.applied_at) } : null,
    roleName: passport.roleName,
    proof: { skills: passport.skills, earned, practising: passport.skills.filter((s) => s.status === "practising").length, total: passport.skills.length, arenaPasses, rating: passport.elo && passport.elo.fromArena > 0 ? Math.round(passport.elo.rating) : null },
    passport: { earned, total: passport.skills.length, shared: Boolean((me.data as { passport_public: boolean | null } | null)?.passport_public) },
    vaultCount: vault.count ?? 0,
    interviewCount,
    applicationCount,
    applications: apps,
    roles,
    move: nextMove({ hasLevel: overview !== null, roleName: passport.roleName, provenCount: earned, target, interviewCount, interviewUnlocked, applicationCount, topRole: top }),
    steps: buildPipeline({ hasLevel: overview !== null, provenCount: earned, interviewCount, applicationCount }),
  };
}
