import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/types";
import { untyped } from "@/lib/org/db";
import { AttemptError, generateWithRetries, loadPublicAttempt } from "@/lib/arena-workstations/attempts";
import { isRegisteredTool, toolFor } from "@/lib/arena-workstations/registry";
import { loadRoleTaxonomy } from "@/lib/arena-workstations/taxonomy";
import { logArenaEvent } from "@/lib/arena-workstations/log";
import { GROQ_MODEL } from "@/lib/ai/groq";
import { difficultyForRating } from "@/lib/arena-workstations/types";
import { loadExperienceLevel } from "@/lib/workplace/level-server";
import { hashSeed } from "@/lib/workplace/rng";
import { currentStage, recordServerEvent, SessionError, SPECS } from "./service";
import { supabaseSessionStore } from "./supabase-store";

type Service = SupabaseClient<Database>;
const UNIQUE_VIOLATION = "23505";

/**
 * Makes the stage the student is on available: generates its ticket on THEIR warehouse (the same world seed as their daily tickets, so every stage
 * of the story is about the same company data) and creates the ordinary attempt that the existing tool and grader serve. Idempotent: a stage that
 * already has an open attempt returns it, so a double click or a reload never makes a second one.
 */
export async function activateStage(service: Service, userId: string, sessionId: string) {
  const store = supabaseSessionStore(service);
  const session = await store.session(userId, sessionId);
  if (!session) throw new SessionError("Session not found.", 404, "not_found");
  if (session.status !== "open") throw new SessionError("This session is closed.", 409, "closed");

  const stages = await store.stages(sessionId);
  const key = currentStage(stages);
  const stage = stages.find((s) => s.stageKey === key);
  if (!stage) throw new SessionError("Every stage is already passed.", 409, "all_passed");

  if (stage.assignmentId) {
    const existing = await loadPublicAttempt(service, userId, stage.assignmentId);
    if (existing) return { stageKey: stage.stageKey, attempt: existing };
  }

  const { role, areas } = await loadRoleTaxonomy(service, session.roleKey);
  const area = areas.find((a) => a.area_key === stage.areaKey);
  if (!area || !area.enabled || !isRegisteredTool(area.tool_type)) throw new SessionError(`The ${stage.areaKey} tool is not available for this role.`, 503, "area_unavailable");
  const tool = toolFor(area.tool_type);
  if (tool.generationVersion !== area.generation_version || tool.gradingVersion !== area.grading_version) throw new SessionError(`The ${stage.areaKey} tool version does not match its configuration.`, 500, "version_mismatch");

  const db = untyped(service);
  const level = await loadExperienceLevel(service, userId);
  const [{ data: rating }, { data: previousRows }] = await Promise.all([
    service.from("arena_skill_ratings").select("rating").eq("user_id", userId).eq("role_key", session.roleKey).eq("area_key", area.area_key).maybeSingle(),
    db.from("arena_challenges").select("title").eq("user_id", userId).eq("scope_key", session.roleKey).order("generated_at", { ascending: false }).limit(20),
  ]);
  const difficulty = difficultyForRating(rating?.rating ?? 1200);
  const generated = await generateWithRetries(
    area,
    {
      roleName: role.display_name, parentSkill: role.parent_skill_name, areaName: area.display_name, difficulty, avoidTitles: ((previousRows ?? []) as { title: string }[]).map((p) => p.title),
      roleKey: session.roleKey, areaKey: area.area_key, worldSeed: hashSeed(userId, session.roleKey, "world"), ticketSeed: hashSeed(userId, session.roleKey, "session", sessionId, stage.stageKey), level, recentKinds: [],
      onlyTaskKinds: SPECS[session.roleKey]?.stagesFor(level).find((s) => s.key === stage.stageKey)?.taskKinds?.slice(),
    },
    { userId, roleKey: session.roleKey, area: area.area_key, difficulty }
  );

  // the immutable instance, shaped like the one the daily flow stores (migration 025, commit_rotation_attempt)
  const { data: challenge, error: challengeError } = await db
    .from("arena_challenges")
    .insert({
      track: "domain", scope_key: session.roleKey, kind: "workstation", title: generated.title, category: generated.category, difficulty, time_limit_minutes: generated.time_limit_minutes, scenario: generated.scenario,
      objective: generated.objective, language: area.tool_type, starter_code: null, expected_output: "", requester: generated.requester, skill_tags: generated.skill_tags, active: true, user_id: userId,
      skill_area_key: area.area_key, tool_type: area.tool_type, content: generated.content as Json, answer_key: generated.answer_key as Json, generation_provider: generated.origin?.provider ?? "groq",
      generation_model: generated.origin?.model ?? GROQ_MODEL, generation_version: tool.generationVersion, grading_version: tool.gradingVersion, generated_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (challengeError || !challenge) throw new AttemptError("We couldn't save your next stage. Nothing was used up, try again.", 503, { retryable: true });

  const { data: attempt, error: attemptError } = await db
    .from("arena_domain_assignments")
    .insert({ user_id: userId, role_key: session.roleKey, challenge_id: (challenge as { id: string }).id, skill_area_key: area.area_key, status: "presented", proof_session_id: sessionId })
    .select("id")
    .single();
  if (attemptError || !attempt) {
    await db.from("arena_challenges").delete().eq("id", (challenge as { id: string }).id);
    if (attemptError?.code === UNIQUE_VIOLATION) {
      // another request activated this stage first: return its attempt
      const fresh = (await store.stages(sessionId)).find((s) => s.stageKey === stage.stageKey);
      const winner = fresh?.assignmentId ? await loadPublicAttempt(service, userId, fresh.assignmentId) : null;
      if (winner) return { stageKey: stage.stageKey, attempt: winner };
    }
    throw new AttemptError("We couldn't start your next stage. Nothing was used up, try again.", 503, { retryable: true });
  }

  const attemptId = (attempt as { id: string }).id;
  await store.updateStage(sessionId, stage.stageKey, { assignmentId: attemptId, status: "active" });
  await recordServerEvent(store, sessionId, { kind: "stage_started", stageKey: stage.stageKey, source: "server" }).catch((e) => logArenaEvent("session.record_failed", { sessionId, reason: (e as Error).message.slice(0, 200) }));
  logArenaEvent("session.stage_started", { userId, sessionId, stage: stage.stageKey, area: area.area_key, difficulty });

  const pub = await loadPublicAttempt(service, userId, attemptId);
  if (!pub) throw new AttemptError("Your stage was created but could not be loaded. Reload to continue.", 500);
  return { stageKey: stage.stageKey, attempt: pub };
}
