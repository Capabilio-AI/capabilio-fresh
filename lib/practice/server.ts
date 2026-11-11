import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { untyped } from "@/lib/org/db";
import { loggedCompleteJson } from "@/lib/ai/log";
import { runCode } from "@/lib/code-execution/wandbox";
import { judge0Configured } from "@/lib/code-execution/judge0";
import { loadGraphContext } from "@/lib/roadmap-visual/context";
import { explainNode } from "@/lib/roadmap-visual/explain-node";
import { findTrack } from "@/lib/languages";
import { allLessons } from "@/lib/languages/types";
import { cached } from "@/lib/skillstudio/lesson-cache";
import {
  EXERCISE_SYSTEM, GeneratedExercises, exercisePrompt, isExerciseLanguage, restoreLineBreaks, runnableLanguage, topicKeyFor,
  type ExerciseTest, type GeneratedExercise, type RunnableLanguage, type StoredExercise, type TopicSource,
} from "./practice";
import { verifyExercise, type Runner } from "./verify";

type Service = SupabaseClient<Database>;

export interface TopicInfo { key: string; title: string; summary: string; language: RunnableLanguage }

/** The runner as the verifier expects it. */
export const liveRunner: Runner = (language, code, stdin) => runCode(language, code, stdin);

/**
 * What a lesson is about, from facts the server holds (the student's own roadmap, or the authored language track), never from the browser.
 * Null when there is no such lesson or its language is not one exercises are offered in.
 */
export async function resolveTopic(service: Service, userId: string, source: TopicSource): Promise<TopicInfo | null> {
  if (source.kind === "track") {
    const track = findTrack(source.track);
    const lesson = track ? allLessons(track).find((l) => l.key === source.lessonKey) : undefined;
    if (!track || !lesson || !isExerciseLanguage(track.runnerLanguage, judge0Configured())) return null;
    return { key: topicKeyFor(source), title: lesson.title, summary: lesson.lesson.summary, language: track.runnerLanguage };
  }
  const loaded = await loadGraphContext(service, userId, "primary");
  const e = loaded.ok ? explainNode(loaded.ctx, source.nodeKey) : null;
  if (!e || e.type !== "TOPIC") return null;
  const language = runnableLanguage(e.title) ?? runnableLanguage(e.description);
  return isExerciseLanguage(language, judge0Configured()) ? { key: topicKeyFor(source), title: e.title, summary: e.description, language } : null;
}

type Row = { id: string; title: string; instructions: string; language: RunnableLanguage; starter_code: string; solution: string; tests: ExerciseTest[] };
const toStored = (r: Row): StoredExercise => ({ id: r.id, title: r.title, instructions: r.instructions, language: r.language, starterCode: r.starter_code, solution: r.solution, tests: r.tests });
const COLUMNS = "id, title, instructions, language, starter_code, solution, tests";

export async function loadExercises(service: Service, topicKey: string): Promise<StoredExercise[]> {
  const { data, error } = await untyped(service).from("lesson_exercises").select(COLUMNS).eq("topic_key", topicKey).order("position");
  // an unreadable table must not look like "no exercises yet", or every lesson open would generate exercises it cannot store
  if (error) throw error;
  return ((data ?? []) as Row[]).map(toStored);
}

export async function loadExercise(service: Service, id: string): Promise<StoredExercise | null> {
  const { data, error } = await untyped(service).from("lesson_exercises").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? toStored(data as Row) : null;
}

/** A lesson whose exercises could not be built is left alone for a while, so a busy runner is not hammered by every student polling for it. */
const COOL_OFF_MS = 5 * 60_000;
const failedAt = new Map<string, number>();
export const recentlyFailed = (topicKey: string, now: number = Date.now()): boolean => now - (failedAt.get(topicKey) ?? 0) < COOL_OFF_MS;

export interface Generated { kept: GeneratedExercise[]; dropped: { title: string; reason: string; infra: boolean }[] }

/** Asks the model for a lesson's exercises and keeps only those that verify on the real runner. Writes nothing. */
export async function generateVerified(service: Service, userId: string | null, topic: TopicInfo, run: Runner = liveRunner): Promise<Generated> {
  const out = await loggedCompleteJson(service, { feature: "lesson_exercises", userId, meta: { topic: topic.key } }, exercisePrompt(topic), EXERCISE_SYSTEM, GeneratedExercises);
  const kept: GeneratedExercise[] = [];
  const dropped: Generated["dropped"] = [];
  for (const raw of out.exercises) {
    const ex: GeneratedExercise = { ...raw, solution: restoreLineBreaks(raw.solution), starterCode: restoreLineBreaks(raw.starterCode), tests: raw.tests.map((t) => ({ ...t, input: restoreLineBreaks(t.input) })) };
    const v = await verifyExercise(ex, topic.language, run);
    if (v.ok) kept.push(ex);
    else dropped.push({ title: ex.title, reason: v.reason, infra: v.infra });
  }
  return { kept, dropped };
}

/**
 * A lesson's exercises: the stored ones, or (the first time anyone opens it) generated, verified and stored. Learners who open the same
 * lesson together wait on one generation. Returns an empty list, storing nothing, when no generated exercise survived verification.
 */
export async function exercisesFor(service: Service, userId: string, topic: TopicInfo): Promise<StoredExercise[]> {
  const stored = await loadExercises(service, topic.key);
  if (stored.length > 0) return stored;
  if (recentlyFailed(topic.key)) return [];
  return cached<StoredExercise[]>(`exercises:${topic.key}`, async () => {
    const { kept, dropped } = await generateVerified(service, userId, topic);
    if (kept.length === 0) throw new Error(dropped.some((d) => d.infra) ? "the code runner was busy, so nothing could be verified" : "no exercise survived verification");
    const { error } = await untyped(service).from("lesson_exercises").upsert(
      kept.map((k, i) => ({ topic_key: topic.key, language: topic.language, position: i, title: k.title, instructions: k.instructions, starter_code: k.starterCode, solution: k.solution, tests: k.tests })),
      { onConflict: "topic_key,title", ignoreDuplicates: true },
    );
    if (error) throw error;
    return loadExercises(service, topic.key);
  }).catch((e) => { failedAt.set(topic.key, Date.now()); console.error("[practice] no exercises for", topic.key, e instanceof Error ? e.message : e); return []; });
}

export interface Progress { attempts: number; passed: boolean }

export async function loadProgress(service: Service, studentId: string, exerciseIds: string[]): Promise<Record<string, Progress>> {
  if (exerciseIds.length === 0) return {};
  const { data } = await untyped(service).from("lesson_exercise_attempts").select("exercise_id, attempts, passed").eq("student_id", studentId).in("exercise_id", exerciseIds);
  return Object.fromEntries(((data ?? []) as { exercise_id: string; attempts: number; passed: boolean }[]).map((r) => [r.exercise_id, { attempts: r.attempts, passed: r.passed }]));
}

/** Counts a run of the tests. Once passed it stays passed, whatever is run afterwards. */
export async function recordAttempt(service: Service, studentId: string, exerciseId: string, passed: boolean, code: string): Promise<void> {
  const db = untyped(service).from("lesson_exercise_attempts");
  const { data } = await db.select("attempts, passed, passed_at").eq("student_id", studentId).eq("exercise_id", exerciseId).maybeSingle();
  const prev = data as { attempts: number; passed: boolean; passed_at: string | null } | null;
  const now = new Date().toISOString();
  const { error } = await db.upsert({
    student_id: studentId, exercise_id: exerciseId, attempts: (prev?.attempts ?? 0) + 1, passed: prev?.passed || passed,
    passed_at: prev?.passed_at ?? (passed ? now : null), last_code: code.slice(0, 10_000), updated_at: now,
  }, { onConflict: "student_id,exercise_id" });
  if (error) throw error;
}
