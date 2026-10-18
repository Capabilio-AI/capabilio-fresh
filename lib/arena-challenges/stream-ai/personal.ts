// Non-IT Stream: challenges are written for the student, from their own branch and current-year subjects, and served as soon as they have
// proved themselves (see generate.ts). They are private rows (user_id set), so no admin publish step is involved.
import type { SupabaseClient } from "@supabase/supabase-js";
import { untyped } from "@/lib/org/db";
import { hashSeed, makeRng } from "@/lib/workplace/rng";
import { claimRun, finishRun, runState } from "../generation-claim";
import type { StreamScope } from "../resolve-scope";
import { mixFor, scaleMix } from "../select-stream";
import { currentStreamWeek } from "../week";
import { loadStreamPool, type StreamStudentContext } from "../stream-context";
import { generateWithRetry, realDeps, type Deps, type StreamAsk, type StreamDraft } from "./generate";
import { missingByDifficulty, planDifficulties, slotKind, subjectFor } from "./plan";
import { buildMission, type MissionDraft } from "../missions/build";
import { labFamily } from "../missions/registry";
import { realStoryDeps, type StoryDeps } from "../missions/story";

const BATCH_PARALLEL = 3;
const BUDGET_MS = 240_000;
const EST_MINUTES = { easy: 8, medium: 12, hard: 15 } as const;
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export const personalRunKey = (userId: string) => `user:${userId}`;

export function toRow(d: StreamDraft, scope: StreamScope, userId: string, subject: string | null) {
  return {
    track: "stream", scope_key: scope.scopeKey, user_id: userId, kind: d.kind, title: d.title, category: d.category, difficulty: d.difficulty,
    scenario: d.scenario, objective: d.objective, language: "python", starter_code: null, stdin: null, expected_output: d.expected, answer_unit: d.answerUnit,
    options: d.options, explanation: d.explanation, skill_tags: d.skillTags, course_tags: subject ? [subject] : [], branch_keys: [scope.branchKey],
    est_minutes: EST_MINUTES[d.difficulty], active: true, status: "PUBLISHED", source: "AI_GENERATED",
  };
}

export function toMissionRow(d: MissionDraft, scope: StreamScope, userId: string, subject: string | null) {
  return {
    track: "stream", scope_key: scope.scopeKey, user_id: userId, kind: "mission", title: d.title, category: d.category, difficulty: d.difficulty,
    scenario: d.story, objective: d.mission, language: "python", starter_code: null, stdin: null, expected_output: "mission", answer_unit: null,
    options: null, explanation: null, problem: { v: 1, lab: d.labKey, scenario: d.scenario }, skill_tags: d.skillTags, course_tags: subject ? [subject] : [],
    branch_keys: [scope.branchKey], est_minutes: d.minutes, active: true, status: "PUBLISHED", source: "AI_GENERATED",
  };
}

interface Args { userId: string; scope: StreamScope; student: StreamStudentContext; count: number; points: number }

/**
 * Called before the week's batch is fixed. Returns preparing=true while the student's missing challenges are being written; `start` (when
 * present) is the work to run after the response (`after(start)`). Never blocks the request on the AI.
 */
export async function preparePersonalPool(service: SupabaseClient, a: Args, deps: Deps = realDeps): Promise<{ preparing: boolean; start?: () => Promise<void> }> {
  const weekStart = currentStreamWeek();
  const { data: existing } = await service.from("arena_stream_weeks").select("challenge_ids").eq("user_id", a.userId).eq("week_start", weekStart).maybeSingle();
  if (existing?.challenge_ids?.length) return { preparing: false };

  const [pool, { data: solvedRows }] = await Promise.all([
    loadStreamPool(service, a.scope, a.userId),
    service.from("arena_challenge_completions").select("challenge_id").eq("user_id", a.userId).eq("track", "stream").eq("is_correct", true),
  ]);
  const solved = new Set((solvedRows ?? []).map((r) => r.challenge_id));
  // a branch with labs is served missions first, so the shared catalog (calculation seeds) must not hide the need to write them
  const counted = labFamily(a.scope.promptLabel) ? pool.filter((c) => !c.shared) : pool;
  const missing = missingByDifficulty(counted, solved, scaleMix(mixFor(a.points, a.student.currentYear), a.count));
  const plan = planDifficulties(missing);
  if (plan.length === 0) return { preparing: false };

  const state = await runState(service, personalRunKey(a.userId), weekStart);
  if (state.generating) return { preparing: true };
  if (state.failedRecently) return { preparing: false }; // serve what exists; try again after the cool-down
  return { preparing: true, start: async () => void (await generatePersonal(service, a, plan, deps)) };
}

/** Writes and stores one challenge per planned difficulty, a few at a time. Returns how many were stored. */
export async function generatePersonal(service: SupabaseClient, a: Args, plan: ReturnType<typeof planDifficulties>, deps: Deps = realDeps, budgetMs = BUDGET_MS, storyDeps: StoryDeps = realStoryDeps): Promise<number> {
  const weekStart = currentStreamWeek();
  const key = personalRunKey(a.userId);
  if (!(await claimRun(service, key, weekStart))) return 0;

  const db = untyped(service);
  let added = 0;
  let note = "";
  try {
    const [{ data: own }, { data: shared }] = await Promise.all([
      db.from("arena_challenges").select("title, category, kind, problem").eq("track", "stream").eq("scope_key", a.scope.scopeKey).eq("user_id", a.userId).limit(400),
      db.from("arena_challenges").select("title").eq("track", "stream").eq("scope_key", a.scope.scopeKey).is("user_id", null).eq("status", "PUBLISHED").limit(100),
    ]);
    const ownRows = (own ?? []) as { title: string; category: string; kind: string; problem: { lab?: string } | null }[];
    const family = labFamily(a.scope.promptLabel);
    const labUsage = new Map<string, number>();
    for (const r of ownRows) if (r.kind === "mission" && r.problem?.lab) labUsage.set(r.problem.lab, (labUsage.get(r.problem.lab) ?? 0) + 1);
    const avoid = [...ownRows.map((r) => r.title), ...((shared ?? []) as { title: string }[]).map((r) => r.title)];
    const usage = new Map<string, number>();
    for (const r of ownRows) usage.set(norm(r.category), (usage.get(norm(r.category)) ?? 0) + 1);

    const deadline = Date.now() + budgetMs;
    const rng = makeRng(hashSeed(a.userId, weekStart, ownRows.length));
    for (let i = 0; i < plan.length && Date.now() < deadline; i += BATCH_PARALLEL) {
      const slots = plan.slice(i, i + BATCH_PARALLEL).map((difficulty, j) => {
        const subject = subjectFor(a.student.courses, a.student.currentYear, usage, rng);
        if (subject) usage.set(norm(subject), (usage.get(norm(subject)) ?? 0) + 1); // so the next slot in this batch picks a different course
        return { difficulty, subject, kind: slotKind(i + j, family !== null), seed: hashSeed(a.userId, weekStart, ownRows.length + i + j) };
      });
      const results = await Promise.all(
        slots.map(async ({ difficulty, subject, kind, seed }): Promise<{ row: Record<string, unknown> | null; title: string; lab: string | null; note: string }> => {
          if (kind === "mission" && family) {
            const mission = await buildMission({ family, difficulty, subject, usage: labUsage, avoidTitles: avoid.slice(-60), seed }, storyDeps);
            if (mission) return { row: toMissionRow(mission, a.scope, a.userId, subject), title: mission.title, lab: mission.labKey, note: "" };
          }
          // a calculation or concept question, also the fallback when no lab could be built
          const ask: StreamAsk = { kind: kind === "mission" ? "numeric" : kind, difficulty, branch: a.scope.promptLabel, subject, year: a.student.currentYear, avoidTitles: avoid.slice(-60), seed };
          const r = await generateWithRetry(ask, deps);
          return r.draft ? { row: toRow(r.draft, a.scope, a.userId, subject), title: r.draft.title, lab: null, note: "" } : { row: null, title: "", lab: null, note: r.reasons.at(-1) ?? "" };
        })
      );
      for (const r of results) {
        if (!r.row) { note = r.note || note; continue; }
        const { error } = await db.from("arena_challenges").insert(r.row);
        if (error) { note = error.message.slice(0, 120); continue; }
        added++;
        avoid.push(r.title);
        if (r.lab) labUsage.set(r.lab, (labUsage.get(r.lab) ?? 0) + 1);
      }
    }
  } catch (e) {
    note = (e as Error).message.slice(0, 120);
  } finally {
    await finishRun(service, key, weekStart, added >= plan.length, note);
  }
  return added;
}
