// Tunable knobs of the two-layer assessment in one place. Nothing here is a scoring secret: the ELO values live in the
// elo_rules table (the server reads them there); the numbers below only shape session length and pool sizes.

export const DIFFICULTIES = ["EASY", "MEDIUM", "HARD"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const QUESTION_TYPES = [
  "scenario",
  "sql_query",
  "code_output",
  "debugging",
  "data_interpretation",
  "decision",
  "calculation",
  "concept",
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const CAREER_QUESTIONS_MIN = 20;
export const CAREER_QUESTIONS_MAX = 25;
export const CAREER_QUESTIONS_DEFAULT = 22;


/** Every question (common and career) has this long. Running out counts as an incorrect answer; the database enforces it too. */
export const QUESTION_SECONDS = 45;
/** Extra time the server allows for the network and the screen to appear, so a slow connection is never penalised. */
export const ANSWER_GRACE_SECONDS = 10;

/** How many upcoming questions are chosen ahead of the student (never sent to the client until served). */
export const PREFETCH_BUFFER = 3;

/** Pool targets per skill (career) and per section (general), by difficulty. Generation tops up to these. */
export const POOL_TARGET_PER_SKILL: Record<Difficulty, number> = { EASY: 2, MEDIUM: 3, HARD: 2 };
export const POOL_TARGET_PER_SECTION: Record<Difficulty, number> = { EASY: 4, MEDIUM: 6, HARD: 4 };

/** Questions requested from Groq per call. Small batches validate far more reliably than one big request. */
export const GENERATION_BATCH_SIZE = 4;

/** A live (blocking) generation for the very first questions gives up after this and falls back to the stored pool. */
export const LIVE_GENERATION_TIMEOUT_MS = 20_000;

/** Bump when the prompt or schema changes meaningfully; stored with every question. */
export const QUESTION_VERSION = 2;

export const CONFIDENCE_LEVELS = ["HIGH", "MEDIUM", "LOW", "INSUFFICIENT"] as const;
export type Confidence = (typeof CONFIDENCE_LEVELS)[number];

/** Readiness counts a skill by weight x confidence factor, so thin evidence cannot swing the number. */
export const CONFIDENCE_FACTOR: Record<Confidence, number> = { HIGH: 1, MEDIUM: 0.8, LOW: 0.5, INSUFFICIENT: 0 };

export const ONBOARDING_STATUSES = [
  "ASSESSMENT_REQUIRED",
  "COMMON_ASSESSMENT_COMPLETE",
  "CAREER_ASSESSMENT_COMPLETE",
  "PROFILE_READY",
] as const;
export type OnboardingStatus = (typeof ONBOARDING_STATUSES)[number];
