import type { StepState } from "./step-proof";

export interface Mastery {
  /** 0 to 100 */
  pct: number;
  /** how the number is made, in words, so a learner can see what moves it */
  basis: string;
  /** the parts a learner can improve, each with what they have and what is possible */
  parts: { key: "questions" | "coding"; label: string; value: string; done: boolean }[];
}

/** Questions are worth 40% and the coding challenge 60% when a lesson has one; with no coding challenge yet the questions are all there is. */
export const QUESTION_WEIGHT = 0.4;
export const CODING_WEIGHT = 0.6;

/** Pure. A learner's mastery of one step, from what the server recorded. The numbers shown are exactly the numbers that produce the percentage. */
export function stepMastery(s: StepState): Mastery {
  const questionPct = s.total === 0 ? 0 : (s.correct / s.total) * 100;
  const questions = { key: "questions" as const, label: "Questions", value: `${s.correct}/${s.total} right${s.answered < s.total ? `, ${s.total - s.answered} to answer` : ""}`, done: s.checkDone };
  if (s.challenge === "none") {
    return { pct: Math.round(questionPct), basis: "From the questions. This step has no coding challenge yet.", parts: [questions, { key: "coding", label: "Coding", value: "challenge coming", done: true }] };
  }
  const codingPct = s.challenge === "passed" ? 100 : 0;
  return {
    pct: Math.round(questionPct * QUESTION_WEIGHT + codingPct * CODING_WEIGHT),
    basis: "Questions count 40% and the coding challenge 60%.",
    parts: [questions, { key: "coding", label: "Coding", value: s.challenge === "passed" ? "passed" : "not passed yet", done: s.challenge === "passed" }],
  };
}
