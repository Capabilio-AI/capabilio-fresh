import type { SupabaseClient } from "@supabase/supabase-js";
import { untyped } from "@/lib/org/db";
import { logArenaEvent } from "@/lib/arena-workstations/log";
import { isIntact, sealEvidence, type SealedContent } from "./seal";

// the table postdates the generated types
type Service = SupabaseClient<any>;

export interface EvidenceRecord {
  attemptId: string;
  userId: string;
  content: SealedContent;
  fingerprint: string;
  shared: boolean;
  intact: boolean;
}

interface Row {
  attempt_id: string; user_id: string; role_key: string; area_key: string; area_name: string | null; company: string | null; skill_ids: string[]; difficulty: string; tool_type: string | null;
  title: string; requester: string | null; scenario: string | null; objective: string | null; submission: unknown; grade: SealedContent["grade"]; submissions: number;
  grading_version: string | null; generation_version: string | null; assigned_at: string; completed_at: string; explained: boolean; explanation_score: number | null;
  schema_version: number; fingerprint: string; shared: boolean;
}

export const RECORD_COLUMNS = "attempt_id, user_id, role_key, area_key, area_name, company, skill_ids, difficulty, tool_type, title, requester, scenario, objective, submission, grade, submissions, grading_version, generation_version, assigned_at, completed_at, explained, explanation_score, schema_version, fingerprint, shared";

export function recordFromRow(r: Row): EvidenceRecord {
  const content: SealedContent = {
    roleKey: r.role_key, areaKey: r.area_key, areaName: r.area_name, company: r.company, skillIds: r.skill_ids ?? [], difficulty: r.difficulty, toolType: r.tool_type, title: r.title,
    requester: r.requester, scenario: r.scenario, objective: r.objective, submission: r.submission ?? null, grade: r.grade, submissions: r.submissions, gradingVersion: r.grading_version,
    generationVersion: r.generation_version, assignedAt: new Date(r.assigned_at).toISOString(), completedAt: new Date(r.completed_at).toISOString(), explained: r.explained,
    explanationScore: r.explanation_score, schemaVersion: r.schema_version,
  };
  return { attemptId: r.attempt_id, userId: r.user_id, content, fingerprint: r.fingerprint, shared: r.shared, intact: isIntact(r.attempt_id, r.user_id, content, r.fingerprint) };
}

/**
 * Seals the record for a task that has just been passed and explained. Safe to call twice (the second is ignored), and it never throws: a missing table or
 * a failed write must not undo a pass, so the failure is logged and the pass stands. Answer keys are never read.
 */
export async function sealAttemptEvidence(service: Service, attemptId: string): Promise<void> {
  try {
    const db = untyped(service);
    const { data: a } = await db.from("arena_domain_assignments").select("id, user_id, role_key, skill_area_key, challenge_id, assigned_at, submission, grade, submission_count").eq("id", attemptId).maybeSingle();
    const attempt = a as { id: string; user_id: string; role_key: string; skill_area_key: string | null; challenge_id: string; assigned_at: string; submission: unknown; grade: SealedContent["grade"] | null; submission_count: number } | null;
    if (!attempt?.grade) return;
    const areaKey = attempt.skill_area_key ?? "";
    const [ch, done, area, primary, extra, interview] = await Promise.all([
      db.from("arena_challenges").select("title, requester, scenario, objective, difficulty, tool_type, content, generation_version, grading_version").eq("id", attempt.challenge_id).maybeSingle(),
      db.from("arena_attempt_completions").select("completed_at, grading_version").eq("attempt_id", attemptId).maybeSingle(),
      db.from("arena_skill_areas").select("display_name").eq("role_key", attempt.role_key).eq("area_key", areaKey).maybeSingle(),
      db.from("arena_skill_areas").select("skill_id").eq("role_key", attempt.role_key).eq("area_key", areaKey).maybeSingle(),
      db.from("arena_area_extra_skills").select("skill_id").eq("role_key", attempt.role_key).eq("area_key", areaKey),
      db.from("arena_task_interviews").select("score, passed").eq("attempt_id", attemptId).maybeSingle(),
    ]);
    const challenge = ch.data as { title: string; requester: string | null; scenario: string; objective: string; difficulty: string; tool_type: string | null; content: { company?: string } | null; generation_version: string | null; grading_version: string | null } | null;
    const completion = done.data as { completed_at: string; grading_version: string | null } | null;
    if (!challenge || !completion) return;
    const iv = interview.data as { score: number | null; passed: boolean } | null;
    const skillIds = [...new Set([(primary.data as { skill_id: string | null } | null)?.skill_id, ...((extra.data ?? []) as { skill_id: string }[]).map((e) => e.skill_id)].filter((s): s is string => Boolean(s)))];

    const { content, fingerprint } = sealEvidence({
      attemptId, userId: attempt.user_id, roleKey: attempt.role_key, areaKey, areaName: (area.data as { display_name: string } | null)?.display_name ?? null, company: challenge.content?.company ?? null,
      skillIds, difficulty: challenge.difficulty, toolType: challenge.tool_type, title: challenge.title, requester: challenge.requester, scenario: challenge.scenario,
      objective: challenge.objective, submission: attempt.submission, grade: attempt.grade, submissions: Math.max(1, attempt.submission_count), gradingVersion: completion.grading_version ?? challenge.grading_version,
      generationVersion: challenge.generation_version, assignedAt: new Date(attempt.assigned_at).toISOString(), completedAt: new Date(completion.completed_at).toISOString(),
      explained: iv?.passed === true, explanationScore: iv?.passed === true ? iv.score : null,
    });
    const { error } = await db.from("evidence_records").upsert(
      {
        attempt_id: attemptId, user_id: attempt.user_id, role_key: content.roleKey, area_key: content.areaKey, area_name: content.areaName, company: content.company, skill_ids: content.skillIds, difficulty: content.difficulty,
        tool_type: content.toolType, title: content.title, requester: content.requester, scenario: content.scenario, objective: content.objective, submission: content.submission, grade: content.grade,
        submissions: content.submissions, grading_version: content.gradingVersion, generation_version: content.generationVersion, assigned_at: content.assignedAt, completed_at: content.completedAt,
        explained: content.explained, explanation_score: content.explanationScore, schema_version: content.schemaVersion, fingerprint,
      },
      { onConflict: "attempt_id", ignoreDuplicates: true }
    );
    if (error) throw error;
    logArenaEvent("evidence.sealed", { attemptId, fingerprint: fingerprint.slice(0, 12) });
  } catch (e) {
    logArenaEvent("evidence.seal_failed", { attemptId, reason: (e as Error).message.slice(0, 200) });
  }
}

/** One student's sealed record for a task, or null when none exists (older tasks, or the table is not there yet). */
export async function getEvidenceRecord(service: Service, attemptId: string, userId: string): Promise<EvidenceRecord | null> {
  const { data, error } = await untyped(service).from("evidence_records").select(RECORD_COLUMNS).eq("attempt_id", attemptId).eq("user_id", userId).maybeSingle();
  if (error || !data) return null;
  return recordFromRow(data as Row);
}

/** Which of a student's tasks have a sealed record, and whether the student shares each one. Empty when there are none. */
export async function getRecordFlags(service: Service, userId: string): Promise<Map<string, { shared: boolean; fingerprint: string }>> {
  const { data, error } = await untyped(service).from("evidence_records").select("attempt_id, shared, fingerprint").eq("user_id", userId);
  if (error) return new Map();
  return new Map(((data ?? []) as { attempt_id: string; shared: boolean; fingerprint: string }[]).map((r) => [r.attempt_id, { shared: r.shared, fingerprint: r.fingerprint }]));
}

/** The student's own choice: show this record to others or not. Returns false when the record is not theirs or does not exist. */
export async function setRecordShared(service: Service, attemptId: string, userId: string, shared: boolean): Promise<boolean> {
  const { data, error } = await untyped(service).from("evidence_records").update({ shared }).eq("attempt_id", attemptId).eq("user_id", userId).select("attempt_id");
  return !error && ((data ?? []) as unknown[]).length > 0;
}
