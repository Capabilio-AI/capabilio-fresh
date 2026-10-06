import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { computeCurrentAcademicYear, DEFAULT_ACADEMIC_START_MONTH, type AcademicYear } from "./academic-year";
import { isCareerDirectionWindow } from "./trigger";

export const GOAL_STATES = ["job", "higher_studies", "entrepreneur", "not_sure"] as const;
export type GoalState = (typeof GOAL_STATES)[number];
export type Track = "job" | "higher_studies" | "entrepreneur";

export const NOT_SURE_RESURFACE_DAYS = 14;
export const HIGHER_STUDIES_CHECKIN_DAYS = 90;
export const YEAR_RECONFIRM_DAYS = 180;
const DAY_MS = 86_400_000;

export function isGoalState(value: unknown): value is GoalState {
  return typeof value === "string" && (GOAL_STATES as readonly string[]).includes(value);
}

/** Unset and "not sure" behave as the Job track everywhere goal_state is read. */
export function trackFor(goalState: GoalState | null): Track {
  return goalState === "higher_studies" || goalState === "entrepreneur" ? goalState : "job";
}

export interface StudentDirection {
  membershipId: string;
  startYear: number | null;
  endYear: number | null;
  academicYear: AcademicYear | null;
  yearConfirmedAt: string | null;
  goalState: GoalState | null;
  track: Track;
  inDirectionWindow: boolean;
  goalStateUpdatedAt: string | null;
  goalStatePromptedAt: string | null;
  higherStudiesCheckinAt: string | null;
  activeRoleKey: string | null;
  portfolioPromptSeenAt: string | null;
  institutionId: string | null;
  branch: string | null;
  /** the curriculum regulation the student follows (e.g. "R23"); null until they or their college set it */
  regulation: string | null;
}

type MembershipRow = Pick<
  Database["public"]["Tables"]["institution_memberships"]["Row"],
  | "id" | "start_year" | "end_year" | "year_confirmed_at" | "year_override" | "goal_state"
  | "goal_state_updated_at" | "goal_state_prompted_at" | "higher_studies_checkin_at"
  | "active_role_key" | "portfolio_prompt_seen_at"
> &
  Partial<Pick<Database["public"]["Tables"]["institution_memberships"]["Row"], "institution_id" | "branch" | "regulation">>;

export function buildDirection(row: MembershipRow, cycleStartMonth: number, now: Date = new Date()): StudentDirection {
  const goalState = isGoalState(row.goal_state) ? row.goal_state : null;
  return {
    membershipId: row.id,
    startYear: row.start_year,
    endYear: row.end_year,
    academicYear: computeCurrentAcademicYear({
      startYear: row.start_year,
      cycleStartMonth,
      override: row.year_override,
      now,
    }),
    yearConfirmedAt: row.year_confirmed_at,
    goalState,
    track: trackFor(goalState),
    inDirectionWindow: isCareerDirectionWindow(row.end_year, now),
    goalStateUpdatedAt: row.goal_state_updated_at,
    goalStatePromptedAt: row.goal_state_prompted_at,
    higherStudiesCheckinAt: row.higher_studies_checkin_at,
    activeRoleKey: row.active_role_key,
    portfolioPromptSeenAt: row.portfolio_prompt_seen_at,
    institutionId: row.institution_id ?? null,
    branch: row.branch ?? null,
    regulation: row.regulation ?? null,
  };
}

const daysSince = (iso: string, now: Date) => (now.getTime() - new Date(iso).getTime()) / DAY_MS;
const latest = (...isos: (string | null)[]) =>
  isos.filter((v): v is string => Boolean(v)).sort().at(-1) ?? null;

/** Years missing entirely, or never confirmed / not re-confirmed within YEAR_RECONFIRM_DAYS. */
export function needsYearConfirmation(d: StudentDirection, now: Date = new Date()): boolean {
  if (d.startYear == null || d.endYear == null) return true;
  return d.yearConfirmedAt == null || daysSince(d.yearConfirmedAt, now) >= YEAR_RECONFIRM_DAYS;
}

/** Goal-state prompt: trigger met, goal unset/"not sure", and not shown/changed in the last 14 days. */
export function shouldShowGoalPrompt(d: StudentDirection, now: Date = new Date()): boolean {
  if (!d.inDirectionWindow) return false;
  if (d.goalState !== null && d.goalState !== "not_sure") return false;
  const last = latest(d.goalStatePromptedAt, d.goalStateUpdatedAt);
  return last == null || daysSince(last, now) >= NOT_SURE_RESURFACE_DAYS;
}

/** Higher Studies "still on this path?" — every 90 days (terms are not modeled). */
export function shouldShowHigherStudiesCheckin(d: StudentDirection, now: Date = new Date()): boolean {
  if (d.goalState !== "higher_studies") return false;
  const last = latest(d.higherStudiesCheckinAt, d.goalStateUpdatedAt);
  return last == null || daysSince(last, now) >= HIGHER_STUDIES_CHECKIN_DAYS;
}

const COLUMNS =
  "id, institution_id, status, branch, regulation, created_at, start_year, end_year, year_confirmed_at, year_override, goal_state, goal_state_updated_at, goal_state_prompted_at, higher_studies_checkin_at, active_role_key, portfolio_prompt_seen_at, institutions ( academic_start_month )";

/**
 * The student's current-program membership, read live (never cached). Same
 * best-row rule as getViewerSummary: education-history rows (SSC, Intermediate)
 * have no branch and are not the current program.
 */
export async function getStudentDirection(
  supabase: SupabaseClient<Database>,
  userId: string,
  now: Date = new Date()
): Promise<StudentDirection | null> {
  const { data } = await supabase
    .from("institution_memberships")
    .select(COLUMNS)
    .eq("user_id", userId)
    .eq("role", "student")
    .order("created_at", { ascending: false });
  const rows = data ?? [];
  // Active only: a pending or revoked membership must not unlock track features.
  const best = rows.find((r) => r.status === "active" && r.branch) ?? null;
  if (!best) return null;
  const institution = best.institutions as { academic_start_month: number } | null;
  return buildDirection(best, institution?.academic_start_month ?? DEFAULT_ACADEMIC_START_MONTH, now);
}
