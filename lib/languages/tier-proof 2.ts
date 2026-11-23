import type { SupabaseClient } from "@supabase/supabase-js";
import { untyped } from "@/lib/org/db";
import { currentWeekStart } from "@/lib/arena-challenges/week";
import type { JudgeTest } from "@/lib/arena-challenges/leetcode/judge";
import type { PublicProblem } from "@/lib/arena-challenges/leetcode/problem";
import { TIERS, type TierNumber } from "./tiers";

/** Learning areas that can carry a tier proof. Only Basic Programming has proof problems today; IT and Stream follow when their content exists. */
export const PROOF_AREAS = ["basic-programming", "it", "stream"] as const;
export type ProofArea = (typeof PROOF_AREAS)[number];
export const PROOF_READY: readonly ProofArea[] = ["basic-programming"];

type Difficulty = "easy" | "medium" | "hard";
/** What a proof attempt is made of, per tier: harder tiers lean on harder problems. */
const MIX: Record<TierNumber, readonly Difficulty[]> = {
  1: ["easy", "easy", "easy", "easy"],
  2: ["easy", "easy", "medium", "medium"],
  3: ["easy", "medium", "medium", "hard"],
  4: ["medium", "medium", "hard", "hard"],
};
export const proofMix = (tier: TierNumber): readonly Difficulty[] => MIX[tier];

/** Pure. A stable 32-bit hash, so the same student gets the same problems all week and a new set next week. */
export function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Pure. `n` distinct ids chosen from `ids` by seed (fewer when there are fewer). No state is needed to find the same set again. */
export function pickBySeed<T extends string>(ids: readonly T[], seed: string, n: number): T[] {
  return [...ids].sort((a, b) => hashSeed(`${seed}:${a}`) - hashSeed(`${seed}:${b}`) || (a < b ? -1 : 1)).slice(0, n);
}

export interface ProofProblem { id: string; title: string; difficulty: Difficulty; problem: PublicProblem }
export interface ProofSet { problems: ProofProblem[]; tests: Record<string, { tests: JudgeTest[]; sampleCount: number }> }

/** The student's proof set for this tier this week, or null when the bank cannot fill the mix (the caller says so instead of passing anyone). */
export async function loadProofSet(service: SupabaseClient, userId: string, tier: TierNumber): Promise<ProofSet | null> {
  const db = untyped(service);
  const mix = proofMix(tier);
  const chosen: string[] = [];
  const rows: Record<string, { id: string; title: string; difficulty: Difficulty; problem: PublicProblem }> = {};
  for (const difficulty of [...new Set(mix)]) {
    const need = mix.filter((d) => d === difficulty).length;
    const { data } = await db.from("arena_challenges").select("id, title, difficulty, problem").eq("track", "stream").eq("kind", "leetcode").eq("active", true).eq("difficulty", difficulty).is("user_id", null).not("problem", "is", null).limit(500);
    const found = (data ?? []) as { id: string; title: string; difficulty: Difficulty; problem: PublicProblem }[];
    const picked = pickBySeed(found.map((r) => r.id), `${userId}:${tier}:${difficulty}:${currentWeekStart()}`, need);
    if (picked.length < need) return null;
    for (const r of found) rows[r.id] = r;
    chosen.push(...picked);
  }
  const { data: t } = await db.from("arena_challenge_tests").select("challenge_id, tests, sample_count").in("challenge_id", chosen);
  const tests: ProofSet["tests"] = Object.fromEntries(((t ?? []) as { challenge_id: string; tests: JudgeTest[]; sample_count: number }[]).map((r) => [r.challenge_id, { tests: r.tests, sampleCount: r.sample_count }]));
  if (chosen.some((id) => !tests[id])) return null;
  return { problems: chosen.map((id) => ({ id, title: rows[id].title, difficulty: rows[id].difficulty, problem: rows[id].problem })), tests };
}

/** The tiers this student has proven in an area. */
export async function loadProvenTiers(service: SupabaseClient, userId: string, area: ProofArea): Promise<TierNumber[]> {
  const { data, error } = await untyped(service).from("learning_tier_proof").select("tier").eq("user_id", userId).eq("area", area);
  if (error) throw new Error(`could not read tier proof: ${error.message}`);
  return ((data ?? []) as { tier: number }[]).map((r) => r.tier).filter((n): n is TierNumber => TIERS.some((t) => t.n === n));
}

/** Writes the proof once; a second pass of the same tier keeps the first (proven stays proven). */
export async function recordTierProof(service: SupabaseClient, userId: string, area: ProofArea, tier: TierNumber, passed: number, total: number, language: string | null): Promise<boolean> {
  const { error } = await untyped(service).from("learning_tier_proof").upsert({ user_id: userId, area, tier, passed, total, language }, { onConflict: "user_id,area,tier", ignoreDuplicates: true });
  return !error;
}
