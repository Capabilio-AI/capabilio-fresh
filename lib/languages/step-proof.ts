import type { SupabaseClient } from "@supabase/supabase-js";
import { untyped } from "@/lib/org/db";
import { loadExercises, loadProgress as loadExerciseProgress } from "@/lib/practice/server";
import { topicKeyFor } from "@/lib/practice/practice";
import { allLessons, type Track, type TrackModule } from "./types";
import type { ProgressMap } from "./progress";

type Service = SupabaseClient;

export interface StepState {
  /** questions the learner has answered, and how many of those were right */
  answered: number;
  correct: number;
  total: number;
  checkDone: boolean;
  /** none: this lesson has no coding challenge yet; open: it has one and it is not passed; passed */
  challenge: "none" | "open" | "passed";
  /** done: every question answered and, where the lesson has a coding challenge, that challenge passed */
  complete: boolean;
}

/** Pure. Where a step stands. Only an answer the server recorded counts, and only an option from 0 to 3. */
export function stepState(i: { questions: readonly { answerIndex: number }[]; answers: Readonly<Record<string, number>>; hasChallenge: boolean; challengePassed: boolean }): StepState {
  let answered = 0;
  let correct = 0;
  i.questions.forEach((q, n) => {
    const a = i.answers[String(n)];
    if (Number.isInteger(a) && a >= 0 && a <= 3) { answered++; if (a === q.answerIndex) correct++; }
  });
  const checkDone = i.questions.length > 0 && answered === i.questions.length;
  const challenge = !i.hasChallenge ? "none" : i.challengePassed ? "passed" : "open";
  return { answered, correct, total: i.questions.length, checkDone, challenge, complete: checkDone && challenge !== "open" };
}

/** Pure. A step opens only when every step before it in its module is complete, so the module is learned in order. */
export function isStepOpen(m: Pick<TrackModule, "lessons">, lessonKey: string, completed: ProgressMap): boolean {
  const at = m.lessons.findIndex((l) => l.key === lessonKey);
  return at >= 0 && m.lessons.slice(0, at).every((l) => completed[l.key]);
}

/** Pure. The first step of the module that is not complete, or the last step when all are. */
export function firstOpenStep(m: Pick<TrackModule, "lessons">, completed: ProgressMap): string {
  return (m.lessons.find((l) => !completed[l.key]) ?? m.lessons[m.lessons.length - 1]).key;
}

export async function loadAnswers(service: Service, userId: string, trackKey: string, lessonKey: string): Promise<Record<string, number>> {
  const { data, error } = await untyped(service).from("language_step_answers").select("answers").eq("user_id", userId).eq("track", trackKey).eq("lesson_key", lessonKey).maybeSingle();
  if (error) throw new Error(`could not read answers: ${error.message}`);
  return ((data as { answers: Record<string, number> } | null)?.answers) ?? {};
}

/**
 * Records a learner's answer to one question on the server. The FIRST answer to a question stands: asking again changes nothing, so a step cannot be passed by
 * trying every option. Two answers at the same moment cannot overwrite each other (the write is conditional and retried).
 */
export async function recordAnswer(service: Service, userId: string, trackKey: string, lessonKey: string, index: number, choice: number): Promise<Record<string, number>> {
  const db = untyped(service);
  for (let attempt = 0; attempt < 6; attempt++) {
    const { data, error } = await db.from("language_step_answers").select("answers, updated_at").eq("user_id", userId).eq("track", trackKey).eq("lesson_key", lessonKey).maybeSingle();
    if (error) throw new Error(`could not read answers: ${error.message}`);
    const row = data as { answers: Record<string, number>; updated_at: string } | null;
    const key = String(index);
    if (row && key in row.answers) return row.answers;
    const merged = { ...(row?.answers ?? {}), [key]: choice };
    if (!row) {
      const ins = await db.from("language_step_answers").insert({ user_id: userId, track: trackKey, lesson_key: lessonKey, answers: merged });
      if (!ins.error) return merged;
      if (ins.error.code !== "23505") throw new Error(`could not record the answer: ${ins.error.message}`);
      continue;
    }
    const upd = await db.from("language_step_answers").update({ answers: merged, updated_at: new Date().toISOString() }).eq("user_id", userId).eq("track", trackKey).eq("lesson_key", lessonKey).eq("updated_at", row.updated_at).select("lesson_key");
    if (upd.error) throw new Error(`could not record the answer: ${upd.error.message}`);
    if (upd.data && upd.data.length > 0) return merged;
  }
  throw new Error("could not record the answer: too many competing writes");
}

export interface ChallengeLookup { hasChallenge: boolean; passed: boolean }

/** Whether a lesson has a verified coding challenge, and whether the learner has passed one. Reads the exercise tables the lesson's practice already uses. */
export async function challengeFor(service: Service, userId: string, trackKey: string, lessonKey: string): Promise<ChallengeLookup> {
  const exercises = await loadExercises(service, topicKeyFor({ kind: "track", track: trackKey, lessonKey }));
  if (exercises.length === 0) return { hasChallenge: false, passed: false };
  const progress = await loadExerciseProgress(service, userId, exercises.map((e) => e.id));
  return { hasChallenge: true, passed: Object.values(progress).some((p) => p.passed) };
}

/**
 * Closes a step if it is ready: every question answered and the lesson's coding challenge passed (when it has one). The score is computed here from the answers the
 * server recorded; nothing the browser sends is used. Safe to call again: a finished step stays finished.
 */
export async function finishStepIfReady(service: Service, userId: string, track: Track, lessonKey: string, challenge?: ChallengeLookup): Promise<StepState> {
  const lesson = allLessons(track).find((l) => l.key === lessonKey);
  if (!lesson) throw new Error(`unknown lesson ${lessonKey}`);
  const [answers, ch] = await Promise.all([loadAnswers(service, userId, track.key, lessonKey), challenge ?? challengeFor(service, userId, track.key, lessonKey)]);
  const state = stepState({ questions: lesson.lesson.check, answers, hasChallenge: ch.hasChallenge, challengePassed: ch.passed });
  if (state.complete) {
    const { error } = await untyped(service).from("language_lesson_progress").upsert(
      { user_id: userId, track: track.key, lesson_key: lessonKey, correct: state.correct, total: state.total, completed_at: new Date().toISOString() },
      { onConflict: "user_id,track,lesson_key", ignoreDuplicates: true },
    );
    if (error) throw new Error(`could not save progress: ${error.message}`);
  }
  return state;
}

/** Which language lesson an exercise belongs to (its topic key is `track:<course>:<lesson>`), or null for an exercise that belongs to something else. */
export async function lessonOfExercise(service: Service, exerciseId: string): Promise<{ track: string; lessonKey: string } | null> {
  const { data, error } = await untyped(service).from("lesson_exercises").select("topic_key").eq("id", exerciseId).maybeSingle();
  if (error) throw new Error(`could not read the exercise: ${error.message}`);
  const m = /^track:([a-z]+):(.+)$/.exec((data as { topic_key: string } | null)?.topic_key ?? "");
  return m ? { track: m[1], lessonKey: m[2] } : null;
}
