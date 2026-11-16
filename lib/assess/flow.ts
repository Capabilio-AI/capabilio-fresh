import { ONBOARDING_STATUSES, type OnboardingStatus } from "./config";
import { getOnboardingStatus, loadCareerSkills, loadCareer, type CareerRef, type Db } from "./db";
import { careerSessionLength } from "./session";
import { generalTotalFor, sectionsFor } from "./general";
import { latestResult } from "./finalize";
import { loadRoleOptions, type RoleOption } from "./roles";
import { matchFocusSkills } from "@/lib/graduate/focus";
import { isPostStudy } from "@/lib/stage/stage";
import { isRoleSkippableYear, studentYear } from "./skip";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export type Stage = "resume" | "career-interest" | "general" | "career" | "done";

const reached = (status: OnboardingStatus, at: OnboardingStatus) => ONBOARDING_STATUSES.indexOf(status) >= ONBOARDING_STATUSES.indexOf(at);

/**
 * Flow: career interest -> general assessment -> career assessment. Career interest comes first, but a student who says
 * "I'm exploring" may take the general assessment before choosing; they must still confirm one career before the career assessment.
 */
export function decideStage(status: OnboardingStatus, intent: { primary: boolean; exploring: boolean }, graduate?: { isGraduate: boolean; hasResume: boolean }, canSkip = false): Stage {
  // Recently graduated: resume, then the role, then ONE role assessment. No general layer.
  if (graduate?.isGraduate) {
    if (reached(status, "CAREER_ASSESSMENT_COMPLETE")) return "done";
    if (!graduate.hasResume) return "resume";
    return intent.primary ? "career" : "career-interest";
  }
  const generalDone = reached(status, "COMMON_ASSESSMENT_COMPLETE");
  const careerDone = reached(status, "CAREER_ASSESSMENT_COMPLETE");
  // a 1st or 2nd year who skipped the role is finished once the common assessment is
  if (!intent.primary && intent.exploring && generalDone && canSkip) return "done";
  if (!intent.primary && !(intent.exploring && !generalDone)) return "career-interest";
  if (!generalDone) return "general";
  if (!careerDone) return "career";
  return "done";
}

export interface FlowSnapshot {
  status: OnboardingStatus;
  stage: Stage;
  careers: CareerRef[];
  primary: CareerRef | null;
  secondary: CareerRef | null;
  general: { skills: string[]; total: number };
  /** the career a "career" stage would assess (the primary, or the Plan B on ?plan=b) */
  assess: { career: CareerRef; skills: { name: string; category: string | null; importance: string }[]; total: number } | null;
  /** every selectable role with its aliases, shipped with the page so the role picker filters instantly (no request per keystroke) */
  roleOptions: RoleOption[];
  commonSections: { label: string; questions: number }[];
  hasOpenCareerSession: boolean;
  hasCareerResult: boolean;
  afterGeneral: boolean;
  /** a 1st or 2nd year with no role yet may skip the role step and take the common assessment only */
  canSkipRole: boolean;
  /** the student skipped the role: the common assessment is their whole assessment for now */
  skippedRole: boolean;
  /** present for recently graduated accounts */
  graduate: { hasResume: boolean; skills: string[]; focus: string[] } | null;
}

export async function getFlowSnapshot(db: Db, userId: string, opts: { plan?: "b" | null; retake?: boolean; changeRole?: boolean } = {}): Promise<FlowSnapshot> {
  // One round of independent reads (not five in a row): this runs on every sign-in, so each saved round trip shows up as faster login.
  const [status, { data: careers }, { data: intent }, { data: me }, { data: resume }, { count: openCount }, roleOptions] = await Promise.all([
    getOnboardingStatus(db, userId),
    db.from("careers").select("id, key, name").eq("is_active", true).order("name"),
    db.from("student_career_intent").select("primary_career_id, secondary_career_id, is_exploring").eq("student_id", userId).maybeSingle(),
    db.from("profiles").select("student_status").eq("id", userId).maybeSingle(),
    db.from("graduate_resumes").select("skill_names").eq("user_id", userId).maybeSingle(),
    db.from("assess_sessions").select("id", { count: "exact", head: true }).eq("student_id", userId).eq("layer", "CAREER").eq("status", "IN_PROGRESS"),
    loadRoleOptions(db),
  ]);
  const isGraduate = isPostStudy(me?.student_status);
  const year = await studentYear(db as unknown as SupabaseClient<Database>, userId);
  const skippable = !isGraduate && isRoleSkippableYear(year);
  const list = (careers ?? []) as CareerRef[];
  const byId = new Map(list.map((c) => [c.id, c]));
  const primary = intent?.primary_career_id ? byId.get(intent.primary_career_id) ?? null : null;
  const secondary = intent?.secondary_career_id ? byId.get(intent.secondary_career_id) ?? null : null;

  let stage = opts.changeRole && status !== "PROFILE_READY" ? "career-interest" : decideStage(status, { primary: !!primary, exploring: !!intent?.is_exploring }, { isGraduate, hasResume: !!resume }, skippable);
  const target = opts.plan === "b" && secondary ? secondary : primary;
  // a finished (or grandfathered) student may take the career assessment on purpose: a retake, or their Plan B
  if (stage === "done" && target && (opts.retake || (opts.plan === "b" && secondary))) stage = "career";

  let assess: FlowSnapshot["assess"] = null;
  let graduateFocus: string[] = [];
  if (stage === "career" && target) {
    const career = await loadCareer(db, target.id);
    const skills = career ? await loadCareerSkills(db, career.id) : [];
    if (career) assess = { career, skills: skills.map((s) => ({ name: s.name, category: s.category, importance: s.importance })), total: careerSessionLength(skills) };
    if (career && isGraduate) {
      const claimed = new Set(matchFocusSkills((resume?.skill_names as string[] | undefined) ?? [], skills));
      graduateFocus = skills.filter((s) => claimed.has(s.skillId)).map((s) => s.name);
    }
  }
  const openCareer = (openCount ?? 0) > 0;
  const hasCareerResult = primary ? (await latestResult(db, userId, "CAREER", primary.id)) !== null : false;
  return {
    status, stage, careers: list, primary, secondary, hasCareerResult,
    general: { skills: sectionsFor(year).map((g) => g.label), total: generalTotalFor(year) },
    assess, afterGeneral: !!intent?.is_exploring && !primary,
    canSkipRole: skippable && !primary,
    skippedRole: skippable && !!intent?.is_exploring && !primary,
    roleOptions,
    commonSections: sectionsFor(year).map((s) => ({ label: s.label, questions: s.questions })),
    hasOpenCareerSession: openCareer,
    graduate: isGraduate ? { hasResume: !!resume, skills: ((resume?.skill_names as string[] | undefined) ?? []).slice(0, 18), focus: graduateFocus } : null,
  };
}
