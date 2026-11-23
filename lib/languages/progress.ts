import type { SupabaseClient } from "@supabase/supabase-js";
import { untyped } from "@/lib/org/db";
import { allLessons, type Track } from "./types";

export interface LessonProgress {
  correct: number;
  total: number;
  completedAt: string;
}
export type ProgressMap = Record<string, LessonProgress>;

export interface TrackProgress {
  done: number;
  total: number;
  pct: number;
  /** the first lesson not yet completed, in track order; null when the track is finished */
  next: { moduleKey: string; lessonKey: string; title: string } | null;
}

/** Pure. Where the student stands in a track, from the lessons they have completed. */
export function trackProgress(track: Track, progress: ProgressMap): TrackProgress {
  const total = allLessons(track).length;
  let done = 0;
  let next: TrackProgress["next"] = null;
  for (const m of track.modules) {
    for (const l of m.lessons) {
      if (progress[l.key]) done++;
      else next ??= { moduleKey: m.key, lessonKey: l.key, title: l.title };
    }
  }
  return { done, total, pct: total === 0 ? 0 : Math.round((done / total) * 100), next };
}

export async function loadProgress(service: SupabaseClient, userId: string, trackKey: Track["key"]): Promise<ProgressMap> {
  const { data, error } = await untyped(service as never).from("language_lesson_progress").select("lesson_key, correct, total, completed_at").eq("user_id", userId).eq("track", trackKey);
  if (error) throw new Error(`could not read language progress: ${error.message}`);
  return Object.fromEntries(((data ?? []) as { lesson_key: string; correct: number; total: number; completed_at: string }[]).map((r) => [r.lesson_key, { correct: r.correct, total: r.total, completedAt: r.completed_at }]));
}
