import { randomInt } from "node:crypto";
import { POOL_TARGET_PER_SECTION, POOL_TARGET_PER_SKILL, DIFFICULTIES, type Difficulty } from "./config";
import type { Db, CareerSkillRow, CareerRef } from "./db";
import { difficultyFallbacks } from "./engine";
import { GENERAL_SECTIONS } from "./general";
import { topUp, type LlmDeps } from "./generate";
import type { CareerSlot, Slot } from "./slots";

/** The part of a pool row that can be used to build a client payload. The answer key is deliberately not selected. */
export interface PoolPick {
  id: string;
  content_hash: string;
  skill_id: string | null;
  section: string | null;
  skill_name: string;
  category: string | null;
  difficulty: Difficulty;
  question_type: string;
  question_text: string;
  options: string[];
  estimated_seconds: number;
}
const PICK_COLUMNS = "id, content_hash, skill_id, section, skill_name, category, difficulty, question_type, question_text, options, estimated_seconds";

export type PoolFilter = { layer: "CAREER"; careerId: string; skillId: string } | { layer: "GENERAL"; section: string };

/**
 * A stored, validated Groq question for (skill/section, difficulty), preferring the wanted difficulty and then the nearest
 * one, never one this session already holds. Random among the candidates so students do not all see the same question.
 */
export async function pickFromPool(db: Db, filter: PoolFilter, want: Difficulty, excludeIds: readonly string[], deterministic = false): Promise<PoolPick | null> {
  // one query for every difficulty, then prefer the wanted level and fall back outward in memory
  let q = db.from("assess_question_pool").select(PICK_COLUMNS).eq("is_active", true).limit(80);
  q = filter.layer === "CAREER" ? q.eq("layer", "CAREER").eq("career_id", filter.careerId).eq("skill_id", filter.skillId) : q.eq("layer", "GENERAL").eq("section", filter.section);
  if (excludeIds.length > 0) q = q.not("id", "in", `(${excludeIds.join(",")})`);
  const { data, error } = await q;
  if (error) throw error;
  const rows = (data ?? []) as unknown as PoolPick[];
  for (const difficulty of difficultyFallbacks(want)) {
    const at = rows.filter((r) => r.difficulty === difficulty);
    // deterministic (common assessment): the lowest content hash, so every student gets the same questions in the same order
    if (at.length > 0) return deterministic ? at.reduce((a, b) => (a.content_hash <= b.content_hash ? a : b)) : at[randomInt(at.length)];
  }
  return null;
}

/** Fisher-Yates over option indexes with a CSPRNG. The result is persisted per attempt (assess_session_questions.option_order). */
/** One query for every candidate of several targets at once (a refill needs up to three slots; this is one round trip, not three). */
export async function fetchCandidates(db: Db, layer: "CAREER" | "GENERAL", careerId: string | null, targetIds: readonly string[], excludeIds: readonly string[]): Promise<PoolPick[]> {
  let q = db.from("assess_question_pool").select(PICK_COLUMNS).eq("is_active", true).limit(400);
  q = layer === "CAREER" ? q.eq("layer", "CAREER").eq("career_id", careerId!).in("skill_id", [...targetIds]) : q.eq("layer", "GENERAL").in("section", [...targetIds]);
  if (excludeIds.length > 0) q = q.not("id", "in", `(${excludeIds.join(",")})`);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as PoolPick[];
}

/** The in-memory twin of pickFromPool: preferred difficulty first, then the nearest. Same rules, no database. */
export function chooseFrom(rows: readonly PoolPick[], layer: "CAREER" | "GENERAL", targetId: string, want: Difficulty, deterministic: boolean): PoolPick | null {
  const mine = rows.filter((r) => (layer === "CAREER" ? r.skill_id : r.section) === targetId);
  for (const difficulty of difficultyFallbacks(want)) {
    const at = mine.filter((r) => r.difficulty === difficulty);
    if (at.length > 0) return deterministic ? at.reduce((a, b) => (a.content_hash <= b.content_hash ? a : b)) : at[randomInt(at.length)];
  }
  return null;
}

export function shuffledOrder(n: number): number[] {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const careerSlot = (career: CareerRef, s: CareerSkillRow): CareerSlot => ({
  kind: "CAREER", careerId: career.id, careerKey: career.key, careerName: career.name,
  skillId: s.skillId, skillKey: s.key, skillName: s.name, skillDescription: s.description, category: s.category,
});

async function countByDifficulty(db: Db, filter: PoolFilter): Promise<Record<Difficulty, number>> {
  let q = db.from("assess_question_pool").select("difficulty").eq("is_active", true);
  q = filter.layer === "CAREER" ? q.eq("layer", "CAREER").eq("career_id", filter.careerId).eq("skill_id", filter.skillId) : q.eq("layer", "GENERAL").eq("section", filter.section);
  const { data } = await q;
  const out: Record<Difficulty, number> = { EASY: 0, MEDIUM: 0, HARD: 0 };
  for (const r of data ?? []) out[r.difficulty as Difficulty]++;
  return out;
}

export interface WarmReport {
  slot: string;
  difficulty: Difficulty;
  inserted: number;
  rejected: number;
  error?: string;
}

/**
 * Brings the pool up to its per-skill (career) or per-section (general) targets. Runs in the background (career
 * confirmation, session start, a script or cron), never while a student waits. Skills are processed in order of
 * importance so a partial run still covers what matters most; a Groq failure for one cell does not stop the others.
 */
export async function warmPool(db: Db, scope: { career: CareerRef; skills: readonly CareerSkillRow[] } | { general: true }, deps: LlmDeps = {}, maxCalls = 60): Promise<WarmReport[]> {
  const cells: { slot: Slot; filter: PoolFilter; label: string; target: Record<Difficulty, number> }[] =
    "general" in scope
      ? GENERAL_SECTIONS.map((g) => ({ slot: g, filter: { layer: "GENERAL", section: g.section }, label: g.section, target: POOL_TARGET_PER_SECTION }))
      : scope.skills.map((s) => ({ slot: careerSlot(scope.career, s), filter: { layer: "CAREER", careerId: scope.career.id, skillId: s.skillId }, label: s.key, target: POOL_TARGET_PER_SKILL }));

  const reports: WarmReport[] = [];
  // The account allows ~8k tokens a minute, so cells are generated one at a time; a failed cell is retried on later passes.
  let calls = 0;
  for (const cell of cells) {
    const have = await countByDifficulty(db, cell.filter);
    for (const difficulty of DIFFICULTIES) {
      const need = cell.target[difficulty] - have[difficulty];
      if (need <= 0) continue;
      if (calls++ >= maxCalls) return reports;
      try {
        const r = await topUp(db, cell.slot, difficulty, need, { deps, rounds: 2 });
        reports.push({ slot: cell.label, difficulty, inserted: r.inserted, rejected: r.rejected.length });
      } catch (e) {
        reports.push({ slot: cell.label, difficulty, inserted: 0, rejected: 0, error: (e as Error).message });
      }
    }
  }
  return reports;
}
