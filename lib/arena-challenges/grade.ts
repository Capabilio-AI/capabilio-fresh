import { ELO_BY_DIFFICULTY, type Difficulty } from "@/lib/arena-workstations/types";
import { effectiveVerification, evaluateCheck, type CheckContext, type CheckRow, type Submission } from "./checks";
import { pointsForDifficulty } from "./points";

export const GRADING_VERSION = "challenge-checks.v1";
/** Weighted share of checks that must pass for the attempt to count as passed. */
export const PASS_THRESHOLD_PCT = 70;

export interface CheckOutcome {
  checkId: string;
  stepId: string | null;
  label: string;
  visible: boolean;
  passed: boolean;
  verification: "SERVER" | "CLIENT";
}

export interface AttemptGrade {
  outcomes: CheckOutcome[];
  checksPassed: number;
  checksTotal: number;
  weightedPct: number;
  passed: boolean;
  /** weightedPct minus hint penalties, 0-100 */
  score: number;
  /** VERIFIED_AUTOMATED only when every check was server-verifiable; a pass resting on browser-reported checks is UNVERIFIED. null when not passed. */
  evidenceStatus: "VERIFIED_AUTOMATED" | "UNVERIFIED" | null;
  /** what a verified pass is worth; the database awards it only for VERIFIED_AUTOMATED */
  points: number;
  elo: number;
}

/**
 * Pure grading from deterministic checks. AI never decides pass/fail. Hints reduce the score (and so the reward) but never turn a pass into
 * a fail: passing is decided by the checks alone.
 */
export async function gradeAttempt(input: { checks: CheckRow[]; submission: Submission; ctx: CheckContext; hintPenaltyPoints: number; difficulty: string }): Promise<AttemptGrade> {
  if (input.checks.length === 0) throw new Error("A challenge with no checks cannot be graded.");

  const outcomes: CheckOutcome[] = await Promise.all(
    input.checks.map(async (c) => ({
      checkId: c.id,
      stepId: c.stepId,
      // a hidden check keeps its label private even in the stored result
      label: c.visible ? c.label : "Hidden check",
      visible: c.visible,
      passed: await evaluateCheck(c, input.submission, input.ctx),
      verification: effectiveVerification(c),
    }))
  );

  const totalWeight = input.checks.reduce((n, c) => n + c.weight, 0);
  const passedWeight = input.checks.reduce((n, c, i) => n + (outcomes[i].passed ? c.weight : 0), 0);
  const weightedPct = Math.round((100 * passedWeight) / totalWeight);
  const passed = weightedPct >= PASS_THRESHOLD_PCT;
  const score = Math.max(0, Math.min(100, weightedPct - Math.max(0, input.hintPenaltyPoints)));
  const allServer = outcomes.every((o) => o.verification === "SERVER");
  const reward = (base: number) => (passed ? Math.max(1, Math.round((base * score) / 100)) : 0);

  return {
    outcomes,
    checksPassed: outcomes.filter((o) => o.passed).length,
    checksTotal: outcomes.length,
    weightedPct,
    passed,
    score,
    evidenceStatus: passed ? (allServer ? "VERIFIED_AUTOMATED" : "UNVERIFIED") : null,
    points: reward(pointsForDifficulty(input.difficulty)),
    elo: reward(ELO_BY_DIFFICULTY[input.difficulty as Difficulty] ?? 0),
  };
}
