import { cache } from "react";
import { createServiceClient } from "@/lib/supabase/service";
import { untyped } from "@/lib/org/db";
import type { PlanId } from "@/lib/plans/catalog";
import { canMove, hasProgrammeEnded, toStage, type CareerStage } from "./stage";

// Untyped: the stage, plan and employment columns (migration 101) postdate the generated types.
const db = () => untyped(createServiceClient());

export interface StageState {
  stage: CareerStage;
  planId: string | null;
  employerName: string | null;
  jobTitle: string | null;
}

interface ProfileRow {
  student_status: string | null;
  plan_id: string | null;
  employer_name: string | null;
  job_title: string | null;
  primary_role: string | null;
}

const toState = (p: ProfileRow | null): StageState => ({
  stage: toStage(p?.student_status),
  planId: p?.plan_id ?? null,
  employerName: p?.employer_name ?? null,
  jobTitle: p?.job_title ?? null,
});

/** Moves the profile forward (never back) and stamps when. Only accounts with the student role have a career stage. */
async function advance(userId: string, to: CareerStage, extra: Record<string, unknown> = {}): Promise<boolean> {
  const { data } = await db().from("profiles").select("student_status, primary_role").eq("id", userId).maybeSingle();
  if (!data || data.primary_role !== "student" || !canMove(toStage(data.student_status), to)) return false;
  const { error } = await db()
    .from("profiles")
    .update({ student_status: to, stage_changed_at: new Date().toISOString(), ...extra })
    .eq("id", userId);
  return !error;
}

/**
 * The profile's current stage. A current student whose programme has ended is moved to graduate right here, so the path
 * changes on the very next request with nobody pressing anything.
 */
export const getStageState = cache(async (userId: string): Promise<StageState> => {
  const { data } = await db().from("profiles").select("student_status, plan_id, employer_name, job_title, primary_role").eq("id", userId).maybeSingle();
  const state = toState(data as ProfileRow | null);
  if (state.stage !== "student" || (data as ProfileRow | null)?.primary_role !== "student") return state;

  const { data: memberships } = await db().from("institution_memberships").select("end_year").eq("user_id", userId).eq("role", "student").eq("status", "active"); // pending/revoked/staff rows must not graduate someone (the move is one-way)
  const years = ((memberships ?? []) as { end_year: number | null }[]).map((m) => m.end_year).filter((y): y is number => y != null);
  // every programme on file must be over, so a second degree still running keeps them a student
  if (years.length === 0 || !years.every((y) => hasProgrammeEnded(y))) return state;
  return (await advance(userId, "graduate")) ? { ...state, stage: "graduate" } : state;
});

/** "I have finished my studies": a student becomes a recently graduated user straight away. */
export const markGraduated = (userId: string) => advance(userId, "graduate");

export interface JobDetails {
  employerName: string;
  jobTitle: string;
  /** YYYY-MM-DD, optional */
  employedSince?: string | null;
  /** YYYY-MM-DD; empty means this is the current job */
  employedUntil?: string | null;
}

export type EmploymentResult = "moved" | "recorded" | "failed";

/**
 * Writes one job into the employment history. A current job (no end date) also moves a student or graduate to the professional
 * path, or, for someone already there, becomes their current employer. A past job is only recorded.
 */
export async function markEmployed(userId: string, job: JobDetails): Promise<EmploymentResult> {
  const current = !job.employedUntil;
  const profile = { employer_name: job.employerName, job_title: job.jobTitle, employed_since: job.employedSince ?? null };
  let result: EmploymentResult = "recorded";

  if (current) {
    if (await advance(userId, "professional", profile)) {
      result = "moved";
    } else {
      const { data } = await db().from("profiles").select("student_status").eq("id", userId).maybeSingle();
      if (toStage(data?.student_status) !== "professional") return "failed";
      const { error } = await db().from("profiles").update(profile).eq("id", userId);
      if (error) return "failed";
    }
  }
  const { error } = await db().from("employment_history").insert({
    user_id: userId,
    employer_name: job.employerName,
    job_title: job.jobTitle,
    start_date: job.employedSince ?? null,
    end_date: job.employedUntil ?? null,
  });
  return error ? "failed" : result;
}

export interface EmploymentEntry {
  id: string;
  employerName: string;
  jobTitle: string;
  startDate: string | null;
  endDate: string | null;
}

/** Most recent first; the current job (no end date) leads. */
export async function listEmployment(userId: string): Promise<EmploymentEntry[]> {
  const { data } = await db().from("employment_history").select("id, employer_name, job_title, start_date, end_date").eq("user_id", userId);
  type Row = { id: string; employer_name: string; job_title: string; start_date: string | null; end_date: string | null };
  return ((data ?? []) as Row[])
    .map((r) => ({ id: r.id, employerName: r.employer_name, jobTitle: r.job_title, startDate: r.start_date, endDate: r.end_date }))
    .sort((a, b) => Number(b.endDate === null) - Number(a.endDate === null) || (b.startDate ?? "").localeCompare(a.startDate ?? ""));
}

export async function deleteEmployment(userId: string, id: string): Promise<boolean> {
  const { error } = await db().from("employment_history").delete().eq("id", id).eq("user_id", userId);
  return !error;
}

/** Records the plan a graduate picked. Nothing is charged: checkout does not exist yet. */
export async function savePlan(userId: string, planId: PlanId): Promise<boolean> {
  const { error } = await db().from("profiles").update({ plan_id: planId, plan_selected_at: new Date().toISOString() }).eq("id", userId);
  return !error;
}
