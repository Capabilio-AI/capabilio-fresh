import { z } from "zod";

/**
 * Pure logic of the baseline check: what an item looks like, how it is graded, which item comes next and what level a set of answers earns.
 * Short on purpose (a few items per topic), so the level is deliberately modest and labelled low confidence until three items back it.
 */
export type Difficulty = "easy" | "medium" | "hard";
export const DIFFICULTIES: readonly Difficulty[] = ["easy", "medium", "hard"];
export const MAX_PER_SKILL = 3;
export const MAX_SKILLS = 8;

const base = { skill: z.string().min(2).max(120), difficulty: z.enum(["easy", "medium", "hard"]), prompt: z.string().trim().min(5).max(2000), explanation: z.string().trim().min(5).max(2000), seconds: z.number().int().min(10).max(900).default(60) };
export const ItemSpec = z.discriminatedUnion("kind", [
  z.object({ ...base, kind: z.literal("MCQ"), options: z.array(z.string().trim().min(1).max(200)).min(3).max(6), correct: z.number().int().min(0) }).strict(),
  z.object({ ...base, kind: z.literal("MULTI_SELECT"), options: z.array(z.string().trim().min(1).max(200)).min(3).max(6), correct: z.array(z.number().int().min(0)).min(1) }).strict(),
  z.object({ ...base, kind: z.literal("NUMERIC"), value: z.number().finite(), tolerance: z.number().min(0).default(0) }).strict(),
]);
export type ItemSpec = z.infer<typeof ItemSpec>;

/** Pure. Structural problems a schema cannot express (an answer index outside the options, duplicate options). */
export function itemProblems(i: ItemSpec): string[] {
  if (i.kind === "NUMERIC") return [];
  const out: string[] = [];
  if (new Set(i.options.map((o) => o.trim().toLowerCase())).size !== i.options.length) out.push("options must be distinct");
  const answers = i.kind === "MCQ" ? [i.correct] : i.correct;
  if (answers.some((a) => a >= i.options.length)) out.push("the correct answer is outside the options");
  if (i.kind === "MULTI_SELECT" && (new Set(answers).size !== answers.length || answers.length >= i.options.length)) out.push("multi-select answers must be distinct and not every option");
  return out;
}

export type StoredKey = { correct: number } | { correct: number[] } | { value: number; tolerance: number };
export const keyOf = (i: ItemSpec): StoredKey => {
  if (i.kind === "NUMERIC") return { value: i.value, tolerance: i.tolerance };
  return i.kind === "MCQ" ? { correct: i.correct } : { correct: i.correct };
};

export type Response = { choice: number } | { choices: number[] } | { value: number };
export const ResponseSchema = z.union([z.object({ choice: z.number().int().min(0).max(5) }).strict(), z.object({ choices: z.array(z.number().int().min(0).max(5)).max(6) }).strict(), z.object({ value: z.number().finite() }).strict()]);

/** Pure. Grades a response against the stored key. A response of the wrong shape for the item is simply incorrect. */
export function grade(kind: "MCQ" | "MULTI_SELECT" | "NUMERIC", key: StoredKey, response: Response): boolean {
  if (kind === "MCQ") return "choice" in response && "correct" in key && typeof key.correct === "number" && response.choice === key.correct;
  if (kind === "MULTI_SELECT") {
    if (!("choices" in response) || !("correct" in key) || !Array.isArray(key.correct)) return false;
    const got = [...new Set(response.choices)].sort();
    const want = [...key.correct].sort();
    return got.length === want.length && got.every((g, i) => g === want[i]);
  }
  return "value" in response && "value" in key && Math.abs(response.value - key.value) <= key.tolerance + 1e-9;
}

export interface Answered {
  difficulty: Difficulty;
  correct: boolean;
}

/**
 * Pure. The difficulty to ask next for one skill, or null when this skill is done. Starts at medium; a right answer goes up, a wrong one down.
 * Stops early when two answers agree decisively (medium + hard right, or medium + easy wrong), or when no unused item is left.
 */
export function nextDifficulty(answered: readonly Answered[], available: readonly Difficulty[]): Difficulty | null {
  const unused = (d: Difficulty) => available.includes(d) && !answered.some((a) => a.difficulty === d);
  if (answered.length >= MAX_PER_SKILL) return null;
  if (answered.length === 0) return (["medium", "easy", "hard"] as const).find(unused) ?? null;
  const last = answered[answered.length - 1];
  if (answered.length === 2) {
    const [a, b] = answered;
    if (a.correct && b.correct && b.difficulty === "hard") return null;
    if (!a.correct && !b.correct && b.difficulty === "easy") return null;
  }
  const order: Difficulty[] = last.correct ? ["hard", "medium", "easy"] : ["easy", "medium", "hard"];
  return order.find(unused) ?? null;
}

const WEIGHT: Record<Difficulty, number> = { easy: 1, medium: 2, hard: 3 };
/** One unit of weight is held back for the unproven part: a short check can't show full mastery, however it goes. */
const PRIOR = 1;

export interface SkillResult {
  level: number;
  answered: number;
  correct: number;
  confidence: "low" | "medium";
}

/** Pure. level = 100 × (difficulty-weighted correct) ÷ (difficulty-weighted answered + 1). null when nothing was answered: never 0. */
export function skillResult(answered: readonly Answered[]): SkillResult | null {
  if (answered.length === 0) return null;
  const possible = answered.reduce((s, a) => s + WEIGHT[a.difficulty], 0);
  const earned = answered.reduce((s, a) => s + (a.correct ? WEIGHT[a.difficulty] : 0), 0);
  return { level: Math.round((100 * earned) / (possible + PRIOR)), answered: answered.length, correct: answered.filter((a) => a.correct).length, confidence: answered.length >= MAX_PER_SKILL ? "medium" : "low" };
}

export const DIAGNOSTIC_FORMULA = "Each question has a weight (easy 1, medium 2, hard 3). Level = 100 × weight of questions you got right ÷ (weight of questions asked + 1). The +1 keeps a short check modest: it cannot show full mastery. The next question gets harder after a right answer and easier after a wrong one. Skipped checks count as not assessed, never as zero.";

/** Pure. The topics to check, core first then by target, limited to those that have published items, at most MAX_SKILLS. Skills already shown by real evidence are left out. */
export function planSkills(topics: { skillId: string; importance: "CORE" | "RECOMMENDED" | "OPTIONAL"; target: number }[], withItems: ReadonlySet<string>, alreadyAssessed: ReadonlySet<string>): string[] {
  const rank = { CORE: 0, RECOMMENDED: 1, OPTIONAL: 2 } as const;
  const seen = new Set<string>();
  return [...topics]
    .filter((t) => withItems.has(t.skillId) && !alreadyAssessed.has(t.skillId))
    .sort((a, b) => rank[a.importance] - rank[b.importance] || b.target - a.target || a.skillId.localeCompare(b.skillId))
    .filter((t) => (seen.has(t.skillId) ? false : (seen.add(t.skillId), true)))
    .slice(0, MAX_SKILLS)
    .map((t) => t.skillId);
}
