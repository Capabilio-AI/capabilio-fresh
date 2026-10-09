import type { Confidence, Difficulty, QuestionType } from "./config";
import type { EloSummary, SectionBar, SkillResult } from "./scoring";

export type Layer = "GENERAL" | "CAREER";

/** What the client may see of a question. The answer key and explanation are NOT part of this type, by construction. */
export interface QuestionPayload {
  sessionQuestionId: string;
  position: number;
  total: number;
  layer: Layer;
  careerName: string | null;
  skillName: string;
  category: string | null;
  difficulty: Difficulty;
  type: QuestionType | string;
  text: string;
  options: string[];
  estimatedSeconds: number;
  /** time left on this question's clock, measured by the server when it built this payload (the browser's clock is never trusted) */
  secondsLeft: number;
}

/** Revealed only in the response to that question's own submission (or when re-reading an already-answered question). */
export interface Feedback {
  isCorrect: boolean;
  /** the clock ran out (or the answer arrived after the limit): counts as incorrect, no option was chosen */
  timedOut: boolean;
  /** -1 when timed out */
  chosenIndex: number;
  correctIndex: number;
  explanation: string;
  alreadyAnswered: boolean;
  /** career layer only; absent for the general diagnostic, which never touches ELO */
  elo: { previous: number; change: number; newRating: number } | null;
  answeredCount: number;
  total: number;
  isLast: boolean;
}

export interface SessionStart {
  sessionId: string;
  layer: Layer;
  total: number;
  careerName: string | null;
  /** names of the skills/sections this session covers, for the transition screen */
  skills: string[];
  resumed: boolean;
  startingElo: number | null;
}

/** One answered question, for the live progress trail and the adaptive-path chart (real data only). */
export interface HistoryItem {
  position: number;
  skillName: string;
  /** what coverage is counted by: the skill (career) or the section label (common) */
  group: string;
  difficulty: Difficulty;
  correct: boolean;
}

export interface SessionState {
  sessionId: string;
  layer: Layer;
  status: "IN_PROGRESS" | "COMPLETED";
  total: number;
  answeredCount: number;
  careerName: string | null;
  /** the question the student is on; null before the first one is served or after the last is answered */
  current: { question: QuestionPayload; feedback: Feedback | null } | null;
  canSubmit: boolean;
  history: HistoryItem[];
  /** career layer: rating when the session began and right now (the ledger, not a client sum) */
  elo: { start: number; now: number } | null;
  /** every skill (career) or section (common) this session covers, in importance order, for the coverage rail */
  roleSkills: { name: string; importance: string | null }[];
}

export interface AssessmentResult {
  layer: Layer;
  completedAt: string;
  career: { id: string; key: string; name: string } | null;
  elo: EloSummary | null;
  readiness: number | null;
  coverage: number | null;
  skills: SkillResult[];
  strongest: SkillResult[];
  focusAreas: SkillResult[];
  notYetMeasured: SkillResult[];
  nextBestAction: string | null;
  general: SectionBar[] | null;
}

export class AssessError extends Error {
  constructor(readonly code: string, message: string, readonly status = 400) {
    super(message);
  }
}
export class PoolUnavailableError extends AssessError {
  constructor() {
    super("POOL_UNAVAILABLE", "We couldn't load your next question just now. Your progress is saved.", 503);
  }
}
export type { Confidence };
