// The proof reel: a 30 to 90 second vertical film about one student, built ONLY from evidence Capabilio verified.
// This file is the script: which scenes exist for this student, what the voice says in each, how long each runs.
// A scene with no real evidence behind it is never created, so a thin record gives a short film and a rich one a longer film.
import type { BadgeLevel } from "./badges";
import { spokenWords } from "./number";

export const REEL_FPS = 30;
export const REEL_W = 1080;
export const REEL_H = 1920;
export const MIN_SECONDS = 30;
export const MAX_SECONDS = 90;

export interface ReelInput {
  holder: { name: string; college: string | null; branch: string | null; classOf: number | null; aspiringFor: string | null; passportNo: string };
  badges: { name: string; level: BadgeLevel; provisional: boolean }[];
  /** the ELO ledger: current rating and its history (oldest first) */
  elo: { rating: number; history: number[] } | null;
  arenaPassed: number;
  /** the most recent passed Arena challenges */
  arena: { title: string; company: string | null; area: string }[];
  interviews: { count: number; best: number; average: number } | null;
  /** verified Vault items only */
  proofs: { title: string; kind: string }[];
  /** verified GitHub connection only */
  github: { username: string; repositories: number | null } | null;
  fingerprint: string;
  measuredAt: string | null;
}

export type SceneKind = "intro" | "start" | "badges" | "momentum" | "arena" | "proofs" | "github" | "interviews" | "outro";
export interface Limits { badges: number; proofs: number; arena: number }
export interface Scene { kind: SceneKind; frames: number; /** what the voice says (and the text transcript) */ say: string }
export interface ReelPlan { scenes: Scene[]; totalFrames: number; limits: Limits }

const sec = (n: number) => Math.round(n * REEL_FPS);
const WORDS_PER_SECOND = 2.3;
const SPEECH_PAD_SECONDS = 1.4;
export const MOMENTUM_MIN_POINTS = 2;

/** Fewer items per scene, step by step, until the film fits in 90 seconds. */
const LIMIT_STEPS: Limits[] = [
  { badges: 8, proofs: 6, arena: 5 }, { badges: 6, proofs: 4, arena: 4 }, { badges: 5, proofs: 3, arena: 3 },
  { badges: 4, proofs: 3, arena: 2 }, { badges: 3, proofs: 2, arena: 2 }, { badges: 2, proofs: 2, arena: 1 },
];

export const hasMomentum = (i: ReelInput) => i.arenaPassed > 0 || (i.elo?.history.length ?? 0) >= MOMENTUM_MIN_POINTS;
const hasEvidence = (i: ReelInput) => i.badges.length > 0 || hasMomentum(i) || i.arena.length > 0 || i.proofs.length > 0 || Boolean(i.github) || Boolean(i.interviews);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const list = (items: string[]) => (items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`);

/** What the voice says, scene by scene. Every sentence is built from a real number or name in the record. */
function lines(i: ReelInput, l: Limits): { kind: SceneKind; say: string; minSeconds: number }[] {
  const h = i.holder;
  const out: { kind: SceneKind; say: string; minSeconds: number }[] = [];
  out.push({ kind: "intro", minSeconds: 4, say: `This is the Capabilio skill passport of ${h.name}${h.aspiringFor ? `, aspiring ${h.aspiringFor}` : ""}${h.college ? `, from ${h.college}` : ""}. Passport ${spokenWords(h.passportNo)}.` });
  if (!hasEvidence(i)) out.push({ kind: "start", minSeconds: 8, say: "Nothing has been verified yet. Capabilio measures skills through a career assessment, Arena challenges and real projects, and this passport fills in by itself as each one is completed." });
  if (i.badges.length) {
    const shown = i.badges.slice(0, l.badges);
    out.push({ kind: "badges", minSeconds: 3 + shown.length * 0.6, say: `Capabilio has measured ${plural(i.badges.length, "skill")} for this student. ${list(shown.map((b) => `${b.name} at ${b.level.toLowerCase()} level`))}. Measured, not claimed.` });
  }
  if (hasMomentum(i)) {
    const parts = [i.arenaPassed > 0 ? `${plural(i.arenaPassed, "Arena challenge")} passed` : null, (i.elo?.history.length ?? 0) >= MOMENTUM_MIN_POINTS ? `career rating moved from ${i.elo!.history[0]} to ${i.elo!.rating}` : null].filter(Boolean) as string[];
    out.push({ kind: "momentum", minSeconds: 5, say: `${parts.join(", and ")}.` });
  }
  if (i.arena.length) {
    const shown = i.arena.slice(0, l.arena);
    out.push({ kind: "arena", minSeconds: 3 + shown.length * 0.9, say: `Recent challenges solved: ${list(shown.map((a) => `${a.title}${a.company ? ` for ${a.company}` : ""}`))}.` });
  }
  if (i.proofs.length) {
    const shown = i.proofs.slice(0, l.proofs);
    out.push({ kind: "proofs", minSeconds: 3 + shown.length * 0.9, say: `Verified proof of work: ${list(shown.map((p) => p.title))}.` });
  }
  if (i.interviews) out.push({ kind: "interviews", minSeconds: 5, say: `${plural(i.interviews.count, "mock interview")} completed, with a best score of ${i.interviews.best} out of 100.` });
  if (i.github) out.push({ kind: "github", minSeconds: 4, say: `Verified GitHub account ${i.github.username}${i.github.repositories ? `, with ${plural(i.github.repositories, "repository")} analysed from real commits` : ""}.` });
  out.push({ kind: "outro", minSeconds: 4.5, say: "Every part of this film comes from verified evidence. Scan the passport again any time: the record updates itself." });
  return out;
}

const speechFrames = (say: string) => sec(say.split(/\s+/).filter(Boolean).length / WORDS_PER_SECOND + SPEECH_PAD_SECONDS);
const build = (i: ReelInput, limits: Limits): ReelPlan => {
  const scenes = lines(i, limits).map((s) => ({ kind: s.kind, say: s.say, frames: Math.max(sec(s.minSeconds), speechFrames(s.say)) }));
  return { scenes, totalFrames: scenes.reduce((n, s) => n + s.frames, 0), limits };
};

/** 30 to 90 seconds, set by how much verified evidence there is: more evidence means more scenes and more items, up to the cap. */
export function planReel(i: ReelInput): ReelPlan {
  let plan = build(i, LIMIT_STEPS[0]);
  for (const step of LIMIT_STEPS) {
    plan = build(i, step);
    if (plan.totalFrames <= sec(MAX_SECONDS)) break;
  }
  const short = sec(MIN_SECONDS) - plan.totalFrames;
  if (short > 0) {
    // too short: let the first and last scenes breathe (no invented content)
    const intro = Math.round(short * 0.4);
    const scenes = plan.scenes.map((s, n) => (n === 0 ? { ...s, frames: s.frames + intro } : n === plan.scenes.length - 1 ? { ...s, frames: s.frames + (short - intro) } : s));
    plan = { ...plan, scenes, totalFrames: sec(MIN_SECONDS) };
  }
  return plan;
}

/** Frame at which each scene starts. */
export const sceneStarts = (plan: ReelPlan): number[] => plan.scenes.map((_, n) => plan.scenes.slice(0, n).reduce((sum, s) => sum + s.frames, 0));
export const sceneAt = (plan: ReelPlan, frame: number): number => {
  const starts = sceneStarts(plan);
  let at = 0;
  starts.forEach((s, n) => { if (frame >= s) at = n; });
  return at;
};

/** The same film as text, for screen readers and anyone who would rather read than watch. */
export const reelTranscript = (i: ReelInput): string[] => planReel(i).scenes.map((s) => s.say);
