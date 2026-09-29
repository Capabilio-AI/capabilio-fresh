import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export interface AttemptEvidence {
  title: string;
  company: string | null;
  areaName: string | null;
  toolLabel: string | null;
  requester: string | null;
  scenario: string;
  objectiveLines: string[];
  grade: { passed: boolean; message: string; checks: { label: string; passed: boolean }[] } | null;
  submissionText: string | null;
  completedAt: string | null;
  assignedAt: string;
  cycleNumber: number | null;
  submissionCount: number;
  difficulty: string;
  generationProvider: string | null;
  generationModel: string | null;
  generationVersion: string | null;
  gradingVersion: string | null;
}

const TOOL_LABEL: Record<string, string> = {
  sql_workspace: "SQL workspace",
  statistics_workspace: "Statistics workspace",
  cleaning_workspace: "Data prep workspace",
  dashboard_workspace: "BI workspace",
  spreadsheet_workspace: "Excel workbook",
};

/**
 * Shared by the full attempt page and both evidence-popup APIs (owner and
 * public-share). Ownership is enforced by the caller passing the correct
 * `userId` — the portfolio owner, whether that's the session user or a
 * public-share target resolved from a slug. Answer keys are never selected.
 */
export async function getAttemptEvidence(service: SupabaseClient<Database>, attemptId: string, userId: string): Promise<AttemptEvidence | null> {
  const { data: attempt } = await service
    .from("arena_domain_assignments")
    .select("id, role_key, skill_area_key, cycle_number, assigned_at, completed_at, submission, grade, submission_count, challenge_id")
    .eq("id", attemptId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!attempt) return null;

  const [{ data: challenge }, { data: completion }, { data: area }] = await Promise.all([
    service
      .from("arena_challenges")
      .select("title, requester, scenario, objective, difficulty, tool_type, content, generation_provider, generation_model, generation_version, grading_version")
      .eq("id", attempt.challenge_id)
      .single(),
    service.from("arena_attempt_completions").select("completed_at, grading_version").eq("attempt_id", attemptId).maybeSingle(),
    service.from("arena_skill_areas").select("display_name").eq("role_key", attempt.role_key).eq("area_key", attempt.skill_area_key ?? "").maybeSingle(),
  ]);
  if (!challenge) return null;

  const submission = attempt.submission as { query?: string } | null;

  return {
    title: challenge.title,
    company: (challenge.content as { company?: string } | null)?.company ?? null,
    areaName: area?.display_name ?? null,
    toolLabel: challenge.tool_type ? (TOOL_LABEL[challenge.tool_type] ?? null) : null,
    requester: challenge.requester,
    scenario: challenge.scenario,
    objectiveLines: challenge.objective.split("\n").map((l) => l.replace(/`/g, "")),
    grade: attempt.grade as AttemptEvidence["grade"],
    submissionText: submission ? (typeof submission.query === "string" ? submission.query : JSON.stringify(submission, null, 2)) : null,
    completedAt: completion?.completed_at ?? null,
    assignedAt: attempt.assigned_at,
    cycleNumber: attempt.cycle_number,
    submissionCount: attempt.submission_count,
    difficulty: challenge.difficulty,
    generationProvider: challenge.generation_provider,
    generationModel: challenge.generation_model,
    generationVersion: challenge.generation_version,
    gradingVersion: completion?.grading_version ?? challenge.grading_version ?? null,
  };
}
