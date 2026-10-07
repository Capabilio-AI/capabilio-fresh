import type { RuntimeType } from "../types";

/** The slice of a check a runtime needs (see loadAttemptView): never the expected answers. */
export interface ViewCheck {
  id: string;
  stepId: string | null;
  type: string;
  visible: boolean;
  label: string | null;
  public: Record<string, unknown> | null;
}

export type AnswerValue = string | number | string[];
export interface SubmissionPayload {
  answers?: Record<string, AnswerValue>;
  queries?: Record<string, string>;
  files?: Record<string, string>;
  reported?: Record<string, boolean>;
}

const record = <T,>(v: unknown): Record<string, T> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, T>) : {});
const known = (checks: ViewCheck[], types: string[]) => new Set(checks.filter((c) => types.includes(c.type)).map((c) => c.id));

/**
 * Pure. Turns a runtime's draft into the submission the server grades. Only answers for real checks are sent; the draft's scratch
 * work (working, notes) stays out. The server validates and grades again -- this only shapes the payload.
 */
export function buildSubmission(runtime: RuntimeType, draft: unknown, checks: ViewCheck[]): SubmissionPayload {
  const d = record<unknown>(draft);
  const only = <T,>(source: Record<string, T>, ids: Set<string>) => Object.fromEntries(Object.entries(source).filter(([id]) => ids.has(id)));

  switch (runtime) {
    case "QUESTION_FLOW":
    case "CALCULATION_WORKSHEET":
    case "NOTEBOOK_PYTHON":
      return { answers: only(record<AnswerValue>(d.answers), known(checks, ["CHOICE_ANSWER", "NUMERIC_ANSWER", "OUTPUT_MATCH"])) };
    case "SQL_CONSOLE":
      return { queries: only(record<string>(d.queries), known(checks, ["QUERY_RESULT"])) };
    case "CODE_EDITOR_PREVIEW":
      return { files: record<string>(d.files), reported: only(record<boolean>(d.results), known(checks, ["TEST_RUN", "DOM_ASSERTION"])) };
    default:
      return {};
  }
}

/** Pure. Which visible checks the browser can already tell the student about while they work (DOM assertions run in the preview). */
export const isLiveCheck = (c: ViewCheck): boolean => c.type === "DOM_ASSERTION" && c.public?.assert !== undefined;
