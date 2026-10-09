import { ONBOARDING_STATUSES, type OnboardingStatus } from "./config";
import { getOnboardingStatus, loadCareerSkills, loadCareer, type CareerRef, type Db } from "./db";
import { careerSessionLength } from "./session";
import { COMMON_SECTION_REGISTRY, GENERAL_SECTIONS, GENERAL_TOTAL } from "./general";
import { latestResult } from "./finalize";
import { loadRoleOptions, type RoleOption } from "./roles";

export type Stage = "career-interest" | "general" | "career" | "done";

const reached = (status: OnboardingStatus, at: OnboardingStatus) => ONBOARDING_STATUSES.indexOf(status) >= ONBOARDING_STATUSES.indexOf(at);

/**
 * Flow: career interest -> general assessment -> career assessment. Career interest comes first, but a student who says
 * "I'm exploring" may take the general assessment before choosing; they must still confirm one career before the career assessment.
 */
export function decideStage(status: OnboardingStatus, intent: { primary: boolean; exploring: boolean }): Stage {
  const generalDone = reached(status, "COMMON_ASSESSMENT_COMPLETE");
  const careerDone = reached(status, "CAREER_ASSESSMENT_COMPLETE");
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
}

export async function getFlowSnapshot(db: Db, userId: string, opts: { plan?: "b" | null; retake?: boolean; changeRole?: boolean } = {}): Promise<FlowSnapshot> {
  const status = await getOnboardingStatus(db, userId);
  const [{ data: careers }, { data: intent }] = await Promise.all([
    db.from("careers").select("id, key, name").eq("is_active", true).order("name"),
    db.from("student_career_intent").select("primary_career_id, secondary_career_id, is_exploring").eq("student_id", userId).maybeSingle(),
  ]);
  const list = (careers ?? []) as CareerRef[];
  const byId = new Map(list.map((c) => [c.id, c]));
  const primary = intent?.primary_career_id ? byId.get(intent.primary_career_id) ?? null : null;
  const secondary = intent?.secondary_career_id ? byId.get(intent.secondary_career_id) ?? null : null;

  let stage = opts.changeRole && status !== "PROFILE_READY" ? "career-interest" : decideStage(status, { primary: !!primary, exploring: !!intent?.is_exploring });
  const target = opts.plan === "b" && secondary ? secondary : primary;
  // a finished (or grandfathered) student may take the career assessment on purpose: a retake, or their Plan B
  if (stage === "done" && target && (opts.retake || (opts.plan === "b" && secondary))) stage = "career";

  let assess: FlowSnapshot["assess"] = null;
  if (stage === "career" && target) {
    const career = await loadCareer(db, target.id);
    const skills = career ? await loadCareerSkills(db, career.id) : [];
    if (career) assess = { career, skills: skills.map((s) => ({ name: s.name, category: s.category, importance: s.importance })), total: careerSessionLength(skills) };
  }
  const { count: openCount } = await db.from("assess_sessions").select("id", { count: "exact", head: true }).eq("student_id", userId).eq("layer", "CAREER").eq("status", "IN_PROGRESS");
  const openCareer = (openCount ?? 0) > 0;
  const hasCareerResult = primary ? (await latestResult(db, userId, "CAREER", primary.id)) !== null : false;
  return {
    status, stage, careers: list, primary, secondary, hasCareerResult,
    general: { skills: GENERAL_SECTIONS.map((g) => g.label), total: GENERAL_TOTAL },
    assess, afterGeneral: !!intent?.is_exploring && !primary,
    roleOptions: await loadRoleOptions(db),
    commonSections: COMMON_SECTION_REGISTRY.filter((s) => s.enabled).map((s) => ({ label: s.label, questions: s.questions })),
    hasOpenCareerSession: openCareer,
  };
}
