import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { untyped } from "@/lib/org/db";

export interface AttemptEvidence {
  title: string;
  company: string | null;
  areaName: string | null;
  toolLabel: string | null;
  requester: string | null;
  scenario: string;
  objectiveLines: string[];
  grade: { passed: boolean; message: string; checks: { label: string; passed: boolean }[]; detail?: unknown } | null;
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
  /** Set for catalog Domain tickets (challenge_attempts); absent for legacy workstation attempts. */
  ticket?: { score: number; checksPassed: number; checksTotal: number; eloDelta: number; hintsUsed: number; reflection: string | null; terminalOutput: string | null; verified: boolean };
}

export type SqlOutputDetail = { columns: string[]; rows: (string | number | boolean | null)[][]; truncated: boolean } | { error: string };

/** Grading `detail` is tool-specific and only the SQL workspace populates it today (its own query result). */
export function sqlOutputDetail(detail: unknown): SqlOutputDetail | null {
  if (typeof detail !== "object" || detail === null) return null;
  if ("error" in detail || "columns" in detail) return detail as SqlOutputDetail;
  return null;
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
  if (!attempt) return getTicketEvidence(service, attemptId, userId);

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

const RUNTIME_LABEL: Record<string, string> = { CODE_EDITOR_PREVIEW: "Code editor", NOTEBOOK_PYTHON: "Python notebook", SQL_CONSOLE: "SQL console", TERMINAL_VM: "Terminal", SIMULATOR: "Simulator", CALCULATION_WORKSHEET: "Calculation worksheet", QUESTION_FLOW: "Question flow" };

/** A finished Domain ticket from the catalog model (challenge_attempts): the brief, what the student wrote, how each check went, the score. Expected answers are never selected. */
async function getTicketEvidence(service: SupabaseClient<Database>, attemptId: string, userId: string): Promise<AttemptEvidence | null> {
  const db = untyped(service);
  const { data: a } = await db.from("challenge_attempts").select("id, challenge_id, status, started_at, submitted_at, score, checks_passed, checks_total, check_results, evidence_status, elo_delta, hints_used, submission, reflection_text, grading_version, runtime_type").eq("id", attemptId).eq("student_id", userId).neq("status", "IN_PROGRESS").maybeSingle();
  if (!a) return null;
  const [{ data: challenge }, { data: steps }, { data: checks }, { data: skills }] = await Promise.all([
    db.from("arena_challenges").select("title, difficulty, ticket_brief, scenario, requester, grading_version").eq("id", a.challenge_id).maybeSingle(),
    db.from("challenge_steps").select("step_order, title, instruction").eq("challenge_id", a.challenge_id).order("step_order"),
    db.from("challenge_checks").select("id, label, visible, config").eq("challenge_id", a.challenge_id),
    db.from("arena_challenge_skills").select("skills ( name )").eq("challenge_id", a.challenge_id),
  ]);
  if (!challenge) return null;

  const checkRows = (checks ?? []) as { id: string; label: string; visible: boolean; config: { public?: { prompt?: string } } | null }[];
  const promptOf = new Map(checkRows.map((c, i) => [c.id, c.config?.public?.prompt || (c.visible ? c.label : `Answer ${i + 1}`)]));
  const sub = (a.submission ?? {}) as { answers?: Record<string, unknown>; queries?: Record<string, string>; terminal?: Record<string, string>; files?: Record<string, string> };
  const lines: string[] = [];
  for (const [id, v] of Object.entries(sub.answers ?? {})) lines.push(`${promptOf.get(id) ?? "Answer"}\n  → ${typeof v === "string" ? v : JSON.stringify(v)}`);
  for (const [id, q] of Object.entries(sub.queries ?? {})) lines.push(`${promptOf.get(id) ?? "Query"}\n${q}`);
  for (const [name, body] of Object.entries(sub.files ?? {})) lines.push(`// ${name}\n${body}`);
  const terminal = Object.values(sub.terminal ?? {}).join("\n").trim() || null;

  const results = (a.check_results ?? []) as { label: string | null; visible: boolean; passed: boolean }[];
  const passed = a.status === "PASSED";
  return {
    title: challenge.title,
    company: null,
    areaName: ((skills ?? []) as unknown as { skills: { name: string } | null }[]).map((s) => s.skills?.name).filter(Boolean).join(", ") || null,
    toolLabel: RUNTIME_LABEL[a.runtime_type as string] ?? null,
    requester: challenge.requester ?? null,
    scenario: challenge.ticket_brief ?? challenge.scenario ?? "",
    objectiveLines: ((steps ?? []) as { step_order: number; title: string; instruction: string }[]).map((s, i) => `${i + 1}. ${s.title}${s.instruction ? ` — ${s.instruction}` : ""}`),
    grade: { passed, message: passed ? "Passed automated checks." : "Did not pass every check.", checks: results.map((r, i) => ({ label: r.visible && r.label ? r.label : `Hidden check ${i + 1}`, passed: r.passed })) },
    submissionText: lines.length ? lines.join("\n\n") : null,
    completedAt: a.submitted_at,
    assignedAt: a.started_at,
    cycleNumber: null,
    submissionCount: 1,
    difficulty: challenge.difficulty,
    generationProvider: null,
    generationModel: null,
    generationVersion: null,
    gradingVersion: a.grading_version ?? challenge.grading_version ?? null,
    ticket: { score: a.score ?? 0, checksPassed: a.checks_passed ?? 0, checksTotal: a.checks_total ?? 0, eloDelta: a.elo_delta ?? 0, hintsUsed: a.hints_used ?? 0, reflection: a.reflection_text ?? null, terminalOutput: terminal, verified: a.evidence_status === "VERIFIED_AUTOMATED" },
  };
}
