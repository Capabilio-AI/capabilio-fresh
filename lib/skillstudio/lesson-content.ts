import { z } from "zod";

// What a generated lesson looks like. The model fills these shapes; nothing outside them is rendered, and no markup is ever trusted.
export const CheckQuestion = z.object({
  question: z.string().max(300),
  options: z.array(z.string().max(160)).length(4),
  answerIndex: z.number().int().min(0).max(3),
  why: z.string().max(400),
});
export type CheckQuestion = z.infer<typeof CheckQuestion>;

export const TheoryLesson = z.object({
  summary: z.string().max(400),
  sections: z
    .array(
      z.object({
        heading: z.string().max(100),
        paragraphs: z.array(z.string().max(900)).min(1).max(4),
        example: z.object({ title: z.string().max(100), code: z.string().max(900).nullable().default(null), explanation: z.string().max(500) }).nullable().default(null),
      })
    )
    .min(2)
    .max(6),
  takeaways: z.array(z.string().max(200)).min(3).max(6),
  mistakes: z.array(z.string().max(240)).max(4).default([]),
  check: z.array(CheckQuestion).min(3).max(4),
});
export type TheoryLesson = z.infer<typeof TheoryLesson>;

export const SCENE_KINDS = ["title", "concept", "steps", "example", "recap"] as const;
export type SceneKind = (typeof SCENE_KINDS)[number];

export const VideoScene = z.object({
  kind: z.enum(SCENE_KINDS),
  heading: z.string().max(90),
  /** short on-screen lines; the narration carries the detail */
  points: z.array(z.string().max(110)).max(5).default([]),
  code: z.string().max(700).nullable().default(null),
  /** what the narrator says over this scene */
  say: z.string().min(20).max(420),
});
export type VideoScene = z.infer<typeof VideoScene>;

export const VideoScript = z.object({
  title: z.string().max(100),
  scenes: z.array(VideoScene).min(5).max(10),
  check: z.array(CheckQuestion).min(2).max(3),
});
export type VideoScript = z.infer<typeof VideoScript>;

export const LESSON_KINDS = ["theory", "video"] as const;
export type LessonKind = (typeof LESSON_KINDS)[number];

// Timing. Narration is the clock: a scene lasts as long as its line takes to say, with a little air either side.
export const EXPLAINER_FPS = 30;
export const EXPLAINER_W = 1280;
export const EXPLAINER_H = 720;
const WORDS_PER_SECOND = 2.5; // about 150 words a minute, a comfortable teaching pace
const MIN_SCENE_SECONDS = 4;
const AIR_SECONDS = 0.8;

export const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
export const sceneSeconds = (say: string) => Math.max(MIN_SCENE_SECONDS, wordCount(say) / WORDS_PER_SECOND + AIR_SECONDS);

export interface ExplainerPlan {
  scenes: { start: number; frames: number }[];
  total: number;
}

export function planExplainer(script: Pick<VideoScript, "scenes">, fps = EXPLAINER_FPS): ExplainerPlan {
  let start = 0;
  const scenes = script.scenes.map((s) => {
    const frames = Math.ceil(sceneSeconds(s.say) * fps);
    const out = { start, frames };
    start += frames;
    return out;
  });
  return { scenes, total: start };
}

/** Which scene a frame belongs to; the last one for anything past the end. */
export function sceneAt(plan: ExplainerPlan, frame: number): number {
  const i = plan.scenes.findIndex((s) => frame >= s.start && frame < s.start + s.frames);
  return i === -1 ? plan.scenes.length - 1 : i;
}
