// Pure adaptive engine: proficiency estimation and "what do we ask next". No I/O, so every rule is unit-tested.
//
// Estimation is difficulty-aware item-response style, not "2 of 3 correct = 66%": each answer is evidence about a latent
// ability theta, weighted by how hard the question was (a miss on an EASY item says more than a miss on a HARD one,
// a hit on a HARD item says more than a hit on an EASY one). The posterior is computed on a small grid (no solver needed).

import type { Confidence, Difficulty } from "./config";

export interface Obs {
  difficulty: Difficulty;
  correct: boolean;
}

const ITEM_B: Record<Difficulty, number> = { EASY: -1, MEDIUM: 0, HARD: 1 };
const DISCRIMINATION = 1.3;
const GUESS = 0.25; // four options
const GRID = Array.from({ length: 61 }, (_, i) => -3 + i * 0.1);
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

export interface SkillEstimate {
  theta: number;
  sd: number;
  n: number;
  /** 0-100, or null when there is no evidence at all (shown as "Insufficient evidence", never a fake number). */
  score: number | null;
  confidence: Confidence;
}

export function estimateSkill(obs: readonly Obs[]): SkillEstimate {
  if (obs.length === 0) return { theta: 0, sd: 1, n: 0, score: null, confidence: "INSUFFICIENT" };
  // N(0,1) prior x item likelihoods, normalised over the grid
  const post = GRID.map((t) => {
    let w = Math.exp(-0.5 * t * t);
    for (const o of obs) {
      const p = GUESS + (1 - GUESS) * sigmoid(DISCRIMINATION * (t - ITEM_B[o.difficulty]));
      w *= o.correct ? p : 1 - p;
    }
    return w;
  });
  const total = post.reduce((a, b) => a + b, 0);
  const mean = post.reduce((a, w, i) => a + w * GRID[i], 0) / total;
  const variance = post.reduce((a, w, i) => a + w * (GRID[i] - mean) ** 2, 0) / total;
  const sd = Math.sqrt(variance);
  const n = obs.length;
  // Confidence is about evidence quantity and how tightly it pins the estimate. Four-option MCQs carry modest
  // information each, so 3+ answers with a tight posterior is as good as this assessment gets.
  const confidence: Confidence = n >= 3 && sd <= 0.9 ? "HIGH" : n >= 2 ? "MEDIUM" : "LOW";
  return { theta: mean, sd, n, score: Math.round(100 * sigmoid(1.1 * mean)), confidence };
}

// ------------------------------------------------------------------------------------------------------------------
// skill coverage
// ------------------------------------------------------------------------------------------------------------------

export interface Target {
  id: string;
  name: string;
  weight: number;
  min: number;
  max: number;
}

/**
 * If the per-skill minimums add up to more than the session has room for, the least important skills give up their
 * minimum first (they can still be asked from the flex budget). Guarantees sum(min) <= total.
 */
export function fitTargets(targets: readonly Target[], total: number): Target[] {
  const out = targets.map((t) => ({ ...t, min: Math.min(t.min, t.max) }));
  let over = out.reduce((a, t) => a + t.min, 0) - total;
  const byLeastImportant = [...out].sort((a, b) => a.weight - b.weight);
  for (const t of byLeastImportant) {
    if (over <= 0) break;
    const cut = Math.min(t.min, over);
    t.min -= cut;
    over -= cut;
  }
  return out;
}

export interface Plan {
  /** items already asked or already lined up (their skills count toward coverage) */
  taken: readonly { id: string; difficulty: Difficulty }[];
  /** answered evidence so far, per target id */
  answered: Readonly<Record<string, readonly Obs[]>>;
}

const countFor = (plan: Plan, id: string) => plan.taken.filter((t) => t.id === id).length;

/**
 * Next skill to ask about. Rules, in order:
 *  1. never exceed a skill's max;
 *  2. if the remaining slots are only enough to meet unmet minimums, ask only from the unmet ones;
 *  3. otherwise prefer skills that are still under their minimum, then by weight x uncertainty (so important skills with
 *     thin or conflicting evidence get the flex questions), avoiding the same skill twice in a row when there is a choice.
 * `sequential` (general layer) just walks the sections in order.
 */
export function chooseSkill(
  targets: readonly Target[],
  plan: Plan,
  total: number,
  opts: { sequential?: boolean; exclude?: ReadonlySet<string> } = {}
): Target | null {
  const exclude = opts.exclude ?? new Set<string>();
  const open = targets.filter((t) => !exclude.has(t.id) && countFor(plan, t.id) < t.max);
  if (open.length === 0) return null;
  if (opts.sequential) return open.find((t) => countFor(plan, t.id) < t.min) ?? open[0];

  const remaining = total - plan.taken.length;
  const debt = (t: Target) => Math.max(0, t.min - countFor(plan, t.id));
  const totalDebt = targets.reduce((a, t) => a + debt(t), 0);
  let pool = open;
  if (remaining <= totalDebt) {
    const unmet = open.filter((t) => debt(t) > 0);
    if (unmet.length > 0) pool = unmet;
  }
  const last = plan.taken[plan.taken.length - 1]?.id;
  const priority = (t: Target) => {
    const n = countFor(plan, t.id);
    const sd = estimateSkill(plan.answered[t.id] ?? []).sd;
    const unmetBoost = debt(t) > 0 ? 10 : 1;
    const repeatPenalty = pool.length > 1 && t.id === last ? 0.4 : 1;
    // weight x uncertainty; each extra question on the same skill is worth less than a first one
    return t.weight * sd * unmetBoost * repeatPenalty / (1 + 0.15 * n);
  };
  return pool.reduce((best, t) => (priority(t) > priority(best) ? t : best), pool[0]);
}

// ------------------------------------------------------------------------------------------------------------------
// difficulty
// ------------------------------------------------------------------------------------------------------------------

const ORDER: Difficulty[] = ["EASY", "MEDIUM", "HARD"];

/**
 * Starts at MEDIUM. Aims at the student's current level (skill estimate blended with the overall run so far) and moves at
 * most one step from the previous question, so easy -> medium -> hard (or back) rather than jumping.
 */
export function chooseDifficulty(skillObs: readonly Obs[], allObs: readonly Obs[], previous: Difficulty | null): Difficulty {
  if (allObs.length === 0 && skillObs.length === 0) return "MEDIUM";
  const overall = estimateSkill(allObs);
  const own = estimateSkill(skillObs);
  const theta = skillObs.length > 0 ? 0.6 * own.theta + 0.4 * overall.theta : overall.theta;
  const aim: Difficulty = theta > 0.45 ? "HARD" : theta < -0.45 ? "EASY" : "MEDIUM";
  if (!previous) return aim;
  const from = ORDER.indexOf(previous);
  const to = ORDER.indexOf(aim);
  return ORDER[from + Math.sign(to - from)] ?? aim;
}

/** Difficulties to try when the pool has nothing at the wanted level: the wanted one first, then nearest neighbours. */
export function difficultyFallbacks(want: Difficulty): Difficulty[] {
  const i = ORDER.indexOf(want);
  return [want, ...ORDER.filter((d) => d !== want).sort((a, b) => Math.abs(ORDER.indexOf(a) - i) - Math.abs(ORDER.indexOf(b) - i))];
}

/** Next (skill, difficulty) slot, or null when every skill is at its max. */
export function planNext(
  targets: readonly Target[],
  plan: Plan,
  total: number,
  opts: { sequential?: boolean; exclude?: ReadonlySet<string>; fixedDifficulty?: (indexInSection: number, sectionQuestions: number) => Difficulty } = {}
): { target: Target; difficulty: Difficulty } | null {
  const target = chooseSkill(targets, plan, total, opts);
  if (!target) return null;
  if (opts.sequential) {
    // common assessment: a fixed difficulty path, identical for everyone (no adaptation)
    return { target, difficulty: opts.fixedDifficulty?.(plan.taken.filter((t) => t.id === target.id).length, target.max) ?? "MEDIUM" };
  }
  const allObs = Object.values(plan.answered).flat();
  const difficulty = chooseDifficulty(plan.answered[target.id] ?? [], allObs, plan.taken[plan.taken.length - 1]?.difficulty ?? null);
  return { target, difficulty };
}
