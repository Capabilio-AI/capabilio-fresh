import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { AttemptError, closeWithoutRating, finishVerified } from "@/lib/arena-workstations/attempts";
import { describeSubmission } from "@/lib/arena-workstations/explain-rules";
import type { TaskBrief } from "@/lib/arena-workstations/explain";
import { logArenaEvent } from "@/lib/arena-workstations/log";
import { loadExperienceLevel } from "@/lib/workplace/level-server";
import { untyped } from "@/lib/org/db";
import { finalizeReport, SPECS } from "./service";
import { supabaseSessionStore } from "./supabase-store";
import type { StageRow } from "./store";

type Service = SupabaseClient<Database>;

/** A session stage never starts the daily cooldown. */
const NO_COOLDOWN_HOURS = 0;

export interface SessionContext {
  sessionId: string;
  /** the last stage's attempt: the one the interview hangs off */
  anchorAttemptId: string;
  stages: StageRow[];
}

/**
 * For an attempt that belongs to a session: the session, or null for a daily ticket. Throws unless the session is open, every stage is passed and this
 * attempt is the last stage, so an interview can never be started (or a rating awarded) early or from a middle stage.
 */
export async function sessionContextFor(service: Service, userId: string, attemptId: string): Promise<SessionContext | null> {
  const { data } = await untyped(service).from("arena_domain_assignments").select("proof_session_id").eq("id", attemptId).eq("user_id", userId).maybeSingle();
  const sessionId = (data as { proof_session_id: string | null } | null)?.proof_session_id ?? null;
  if (!sessionId) return null;
  const store = supabaseSessionStore(service);
  const session = await store.session(userId, sessionId);
  if (!session || session.status !== "open") throw new AttemptError("This session is already closed.", 409);
  const stages = await store.stages(sessionId);
  if (stages.length === 0 || stages.some((s) => s.status !== "passed")) throw new AttemptError("Pass every stage before explaining your work.", 409, { reason: "stages_remaining" });
  const anchor = stages[stages.length - 1];
  if (anchor.assignmentId !== attemptId) throw new AttemptError("Explain your work from the last stage of the session.", 409, { reason: "not_anchor" });
  return { sessionId, anchorAttemptId: attemptId, stages };
}

/** One brief for the whole session: what was asked and everything the student handed in, stage by stage. */
export async function sessionBrief(service: Service, userId: string, ctx: SessionContext, areaNames: Map<string, string>): Promise<TaskBrief> {
  const db = untyped(service);
  const spec = SPECS["data-analyst"];
  const parts: string[] = [];
  const passed: string[] = [];
  for (const stage of ctx.stages) {
    if (!stage.assignmentId) continue;
    const { data: attempt } = await db.from("arena_domain_assignments").select("submission, grade, challenge_id").eq("id", stage.assignmentId).eq("user_id", userId).maybeSingle();
    const a = attempt as { submission: unknown; grade: { checks?: { label: string; passed: boolean }[] } | null; challenge_id: string } | null;
    if (!a) continue;
    const { data: ch } = await db.from("arena_challenges").select("title, tool_type").eq("id", a.challenge_id).maybeSingle();
    const c = ch as { title: string; tool_type: string | null } | null;
    parts.push(`Stage ${stage.stageIndex + 1} (${areaNames.get(stage.areaKey) ?? stage.areaKey}): ${c?.title ?? ""}\n${describeSubmission(c?.tool_type ?? "", a.submission)}`);
    for (const check of a.grade?.checks ?? []) if (check.passed) passed.push(check.label);
  }
  return {
    title: spec?.title ?? "Proof Session", requester: null, scenario: "A multi-stage piece of work on one company's data, done end to end.", objective: "Explain your approach, your checks and what you would do differently.",
    skill: null, difficulty: "medium", submission: parts.join("\n\n"), passedChecks: passed,
  };
}

async function closeAndReport(service: Service, userId: string, sessionId: string) {
  const store = supabaseSessionStore(service);
  await store.closeSession(sessionId, "finished");
  try {
    await finalizeReport(store, { userId, sessionId, level: await loadExperienceLevel(service, userId) });
  } catch (e) {
    // the report can be rebuilt on demand; a failure here must not undo the awarded ratings
    logArenaEvent("session.report_failed", { userId, sessionId, reason: (e as Error).message.slice(0, 200) });
  }
}

/** The explanation held up: every passed stage gets its rating and evidence (no cooldown), the anchor last so a failure part-way can be retried. */
export async function finishSessionRated(service: Service, userId: string, ctx: SessionContext) {
  const ordered = [...ctx.stages.filter((s) => s.assignmentId && s.assignmentId !== ctx.anchorAttemptId), ...ctx.stages.filter((s) => s.assignmentId === ctx.anchorAttemptId)];
  let points = 0;
  const evidenceIds: string[] = [];
  for (const stage of ordered) {
    const done = await finishVerified(service, userId, stage.assignmentId!, NO_COOLDOWN_HOURS);
    points += done.points;
    if (done.evidenceId) evidenceIds.push(done.evidenceId);
  }
  await closeAndReport(service, userId, ctx.sessionId);
  logArenaEvent("session.finished", { userId, sessionId: ctx.sessionId, stages: ordered.length, points });
  return { points, evidenceIds, nextAvailableAt: new Date().toISOString() };
}

/** The student skipped or did not pass the explanation: the stages close with no rating and no cooldown. */
export async function finishSessionUnrated(service: Service, userId: string, ctx: SessionContext): Promise<string> {
  let nextAvailableAt = new Date().toISOString();
  for (const stage of ctx.stages) if (stage.assignmentId) nextAvailableAt = await closeWithoutRating(service, stage.assignmentId, 0);
  await closeAndReport(service, userId, ctx.sessionId);
  logArenaEvent("session.closed_unrated", { userId, sessionId: ctx.sessionId });
  return nextAvailableAt;
}
