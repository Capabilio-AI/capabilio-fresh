import type { CrtModule } from "../model";

export type Rng = () => number;

/** Small deterministic PRNG, so the same seed always builds the same bank. */
export function rng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const int = (r: Rng, lo: number, hi: number): number => lo + Math.floor(r() * (hi - lo + 1));
export const pick = <T,>(r: Rng, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];
export function shuffle<T>(r: Rng, xs: readonly T[]): T[] {
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** One question before its options are laid out: the right answer, plausible wrong ones, and why. */
export interface Draft {
  topic: string;
  difficulty: 1 | 2 | 3;
  prompt: string;
  correct: string;
  wrongs: string[];
  explanation: string;
}

export interface BankRow {
  module: CrtModule;
  topic: string;
  difficulty: number;
  prompt: string;
  options: { key: string; text: string; points: number }[];
  explanation: string;
}

const KEYS = ["a", "b", "c", "d"] as const;

/** Lays a draft out as four shuffled options (a-d). Wrong answers that repeat the right one or each other are dropped. */
export function layout(r: Rng, module: CrtModule, d: Draft): BankRow | null {
  const wrongs = [...new Set(d.wrongs.filter((w) => w !== d.correct))].slice(0, 3);
  if (wrongs.length < 3) return null;
  const shuffled = shuffle(r, [{ text: d.correct, points: 1 }, ...wrongs.map((text) => ({ text, points: 0 }))]);
  return { module, topic: d.topic, difficulty: d.difficulty, prompt: d.prompt, options: shuffled.map((o, i) => ({ key: KEYS[i], ...o })), explanation: d.explanation };
}

/** Wrong numbers near `n` (never n itself, never below `min`), formatted for display. */
export function near(r: Rng, n: number, fmt: (x: number) => string = String, min = 0): string[] {
  const step = Math.max(1, Math.round(Math.abs(n) / 10));
  const offsets = shuffle(r, [1, -1, 2, -2, 3, -3, 5, -5, 10, -10].map((k) => k * step));
  return [...new Set(offsets.map((o) => n + o).filter((x) => x !== n && x >= min))].slice(0, 5).map(fmt);
}

/** Calls `make` until it has produced `count` questions with distinct prompts (or runs out of tries). */
export function collect(r: Rng, module: CrtModule, count: number, make: (r: Rng) => Draft | null): BankRow[] {
  const seen = new Set<string>();
  const out: BankRow[] = [];
  for (let tries = 0; out.length < count && tries < count * 40; tries++) {
    const d = make(r);
    const row = d ? layout(r, module, d) : null;
    if (!row || seen.has(row.prompt)) continue;
    seen.add(row.prompt);
    out.push(row);
  }
  return out;
}
