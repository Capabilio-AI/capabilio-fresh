export const RUNTIME_TYPES = ["CODE_EDITOR_PREVIEW", "NOTEBOOK_PYTHON", "SQL_CONSOLE", "TERMINAL_VM", "SIMULATOR", "CALCULATION_WORKSHEET", "QUESTION_FLOW"] as const;
export type RuntimeType = (typeof RUNTIME_TYPES)[number];

export const CHECK_TYPES = ["TEST_RUN", "QUERY_RESULT", "NUMERIC_ANSWER", "CHOICE_ANSWER", "OUTPUT_MATCH", "FILE_STATE", "TERMINAL_OUTPUT", "DOM_ASSERTION"] as const;
export type CheckType = (typeof CHECK_TYPES)[number];

/** SERVER: the server can re-evaluate the check from the submitted artifact. CLIENT: only the student's browser ran it. */
export type Verification = "SERVER" | "CLIENT";

export type EvidenceStatus = "VERIFIED_AUTOMATED" | "NEEDS_REVIEW" | "UNVERIFIED";
export type AttemptStatus = "IN_PROGRESS" | "PASSED" | "FAILED" | "NEEDS_REVIEW" | "EXPIRED" | "ABANDONED";
export type ChallengeStatus = "DRAFT" | "PUBLISHED" | "RETIRED";
export type ChallengeSource = "CAPABILIO" | "COLLEGE" | "MENTOR" | "AI_GENERATED";
