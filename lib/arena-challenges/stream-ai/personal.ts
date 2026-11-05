// Non-IT Stream: one shared bank per branch, the same model as the IT bank. A challenge is written when a student's week is short of their
// difficulty mix, from their branch and current-year subjects, and stored once for every student of that branch. It is served only after it
// has proved itself (see generate.ts), so no admin publish step is involved. Students solved ones are excluded per student by the selector.
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
const DUPLICATE_RETRIES = 6;
/** one lab set-up: the same lab, difficulty and numbers is the same mission, however it is told */
const fingerprint = (lab: string, difficulty: string, scenario: unknown) => `${lab}|${difficulty}|${canonical(scenario)}`;
/** JSON with sorted keys, because the database hands objects back in its own key order */
const canonical = (v: unknown): string => (Array.isArray(v) ? `[${v.map(canonical).join(",")}]` : v && typeof v === "object" ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`).join(",")}}` : JSON.stringify(v));
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** most generated challenges kept per branch; past this the bank is served from the database with no AI call */
export const BRANCH_BANK_CAP = 2000;

/** one generation run per branch and week, so two students of the same branch never write the same set twice */
export const branchRunKey = (scopeKey: string) => `branch:${scopeKey}`;

/** userId null = a shared branch-bank row (machine-validated, AI_WEEKLY like the IT bank); set = private to that student */
export function toRow(d: StreamDraft, scope: StreamScope, userId: string | null, subject: string | null) {
  return {
    track: "stream", scope_key: scope.scopeKey, user_id: userId, kind: d.kind, title: d.title, category: d.category, difficulty: d.difficulty,
    scenario: d.scenario, objective: d.objective, language: "python", starter_code: null, stdin: null, expected_output: d.expected, answer_unit: d.answerUnit,
    options: d.options, explanation: d.explanation, skill_tags: d.skillTags, course_tags: subject ? [subject] : [], branch_keys: [scope.branchKey],
    est_minutes: EST_MINUTES[d.difficulty], active: true, status: "PUBLISHED", source: userId ? "AI_GENERATED" : "AI_WEEKLY",
  };
}

export function toMissionRow(d: MissionDraft, scope: StreamScope, userId: string | null, subject: string | null) {
  return {
    track: "stream", scope_key: scope.scopeKey, user_id: userId, kind: "mission", title: d.title, category: d.category, difficulty: d.difficulty,
    scenario: d.story, objective: d.mission, language: "python", starter_code: null, stdin: null, expected_output: "mission", answer_unit: null,
    options: null, explanation: null, problem: { v: 1, lab: d.labKey, scenario: d.scenario }, skill_tags: d.skillTags, course_tags: subject ? [subject] : [],
    branch_keys: [scope.branchKey], est_minutes: d.minutes, active: true, status: "PUBLISHED", source: userId ? "AI_GENERATED" : "AI_WEEKLY",
  };
}

interface Args { userId: string; scope: StreamScope; student: StreamStudentContext; count: number; points: number }

/**
 * Called before the week's batch is fixed. Returns preparing=true while the branch bank's missing challenges are being written; `start` (when
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
  const missing = missingByDifficulty(pool, solved, scaleMix(mixFor(a.points, a.student.currentYear), a.count));
  const plan = planDifficulties(missing);
  if (plan.length === 0) return { preparing: false };

  if ((await bankCount(service, a.scope)) >= BRANCH_BANK_CAP) return { preparing: false }; // bank full: served from the database, no AI call
  const state = await runState(service, branchRunKey(a.scope.scopeKey), weekStart);
  if (state.generating) return { preparing: true };
  if (state.failedRecently) return { preparing: false }; // serve what exists; try again after the cool-down
  return { preparing: true, start: async () => void (await generatePersonal(service, a, plan, deps)) };
}

async function bankCount(service: SupabaseClient, scope: StreamScope): Promise<number> {
  const { count } = await untyped(service).from("arena_challenges").select("id", { count: "exact", head: true }).eq("track", "stream").eq("scope_key", scope.scopeKey).is("user_id", null).eq("source", "AI_WEEKLY").eq("status", "PUBLISHED");
  return count ?? 0;
}

/** Writes and stores one shared challenge per planned difficulty, a few at a time. Returns how many were stored. */
export async function generatePersonal(service: SupabaseClient, a: Omit<Args, "userId"> & { userId: string | null }, plan: ReturnType<typeof planDifficulties>, deps: Deps = realDeps, budgetMs = BUDGET_MS, storyDeps: StoryDeps = realStoryDeps): Promise<number> {
  const weekStart = currentStreamWeek();
  const key = branchRunKey(a.scope.scopeKey);
  if (!(await claimRun(service, key, weekStart))) return 0;

  const db = untyped(service);
  let added = 0;
  let note = "";
  try {
    const { data: bank } = await db.from("arena_challenges").select("title, category, kind, difficulty, problem").eq("track", "stream").eq("scope_key", a.scope.scopeKey).or(a.userId ? `user_id.is.null,user_id.eq.${a.userId}` : "user_id.is.null").limit(BRANCH_BANK_CAP + 400);
    const ownRows = (bank ?? []) as { title: string; category: string; kind: string; difficulty: string; problem: { lab?: string; scenario?: unknown } | null }[];
    const family = labFamily(a.scope.promptLabel);
    const labUsage = new Map<string, number>();
    for (const r of ownRows) if (r.kind === "mission" && r.problem?.lab) labUsage.set(r.problem.lab, (labUsage.get(r.problem.lab) ?? 0) + 1);
    const avoid = ownRows.map((r) => r.title);
    const seen = new Set(ownRows.flatMap((r) => (r.kind === "mission" && r.problem?.lab ? [fingerprint(r.problem.lab, r.difficulty, r.problem.scenario)] : [])));
    const usage = new Map<string, number>();
    for (const r of ownRows) usage.set(norm(r.category), (usage.get(norm(r.category)) ?? 0) + 1);

    const deadline = Date.now() + budgetMs;
    const rng = makeRng(hashSeed(a.userId ?? a.scope.scopeKey, weekStart, ownRows.length));
    for (let i = 0; i < plan.length && Date.now() < deadline; i += BATCH_PARALLEL) {
      const slots = plan.slice(i, i + BATCH_PARALLEL).map((difficulty, j) => {
        const subject = subjectFor(a.student.courses, a.student.currentYear, usage, rng);
        if (subject) usage.set(norm(subject), (usage.get(norm(subject)) ?? 0) + 1); // so the next slot in this batch picks a different course
        return { difficulty, subject, kind: slotKind(i + j, family !== null), seed: hashSeed(a.userId ?? a.scope.scopeKey, weekStart, ownRows.length + i + j) };
      });
      const results = await Promise.all(
        slots.map(async ({ difficulty, subject, kind, seed }): Promise<{ row: Record<string, unknown> | null; title: string; lab: string | null; note: string }> => {
          if (kind === "mission" && family) {
            // a lab branch gets missions only; a repeated set-up (same lab, difficulty and numbers) is rebuilt from another seed
            for (let t = 0; t < DUPLICATE_RETRIES; t++) {
              const mission = await buildMission({ family, difficulty, subject, usage: labUsage, avoidTitles: avoid.slice(-60), seed: seed + t * 7919 }, storyDeps);
              if (!mission) break;
              const print = fingerprint(mission.labKey, mission.difficulty, mission.scenario);
              if (seen.has(print)) continue;
              seen.add(print);
              return { row: toMissionRow(mission, a.scope, null, subject), title: mission.title, lab: mission.labKey, note: "" };
            }
            return { row: null, title: "", lab: null, note: "no new lab set-up found" };
          }
          // a calculation or concept question, also the fallback when no lab could be built
          const ask: StreamAsk = { kind: kind === "mission" ? "numeric" : kind, difficulty, branch: a.scope.promptLabel, subject, year: a.student.currentYear, avoidTitles: avoid.slice(-60), seed };
          const r = await generateWithRetry(ask, deps);
          return r.draft ? { row: toRow(r.draft, a.scope, null, subject), title: r.draft.title, lab: null, note: "" } : { row: null, title: "", lab: null, note: r.reasons.at(-1) ?? "" };
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
