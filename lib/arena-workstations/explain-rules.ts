// Pure rules for the "explain your work" interview. No AI or server code in here, so the interview screen can import it.
/** After a task is solved the user explains their work; the rating is awarded only if the explanation holds up. */
export const QUESTION_COUNT = 4;
/** The score (0-100) at which the explanation counts and the rating is awarded. */
export const PASS_SCORE = 50;
/** How many times a user may explain a task: a second try gets fresh questions. */
export const MAX_ATTEMPTS = 2;
export const MAX_ANSWER_CHARS = 1200;
/** Fewer words than this across all answers means no real explanation was given. */
const MIN_WORDS = 20;
const LIMIT = 1800;

const clip = (s: string, n = LIMIT) => (s.length > n ? `${s.slice(0, n)}…` : s);
const note = (v: unknown) => (typeof (v as { note?: unknown })?.note === "string" && (v as { note: string }).note.trim() ? `\n\nNote they left: ${(v as { note: string }).note.trim()}` : "");

/** Pure. What the user submitted, in words the interviewer (and the user) can read. Never includes an answer key. */
export function describeSubmission(toolType: string, submission: unknown): string {
  if (!submission || typeof submission !== "object") return "";
  const s = submission as Record<string, unknown>;
  if (toolType === "sql_workspace" && typeof s.query === "string") return `SQL they wrote:\n${clip(s.query)}${note(s)}`;
  if (toolType === "cleaning_workspace" && Array.isArray(s.steps)) {
    return `Cleaning steps they applied:\n${clip((s.steps as { op?: string; column?: string; columns?: string[] }[]).map((st, i) => `${i + 1}. ${st.op ?? "step"} on ${st.column ?? st.columns?.join(", ") ?? "the table"}`).join("\n"))}`;
  }
  if (toolType === "spreadsheet_workspace" && s.cells && typeof s.cells === "object") {
    return `Formulas they wrote:\n${clip(Object.entries(s.cells as Record<string, string>).slice(0, 12).map(([cell, f]) => `${cell}: ${f}`).join("\n"))}`;
  }
  if (toolType === "investigation_workspace" && s.answers && typeof s.answers === "object") {
    return `Findings they reported:\n${clip(Object.entries(s.answers as Record<string, unknown>).map(([k, v]) => `${k}: ${String(v)}`).join("\n"))}${note(s)}`;
  }
  if (toolType === "code_workspace" && typeof s.code === "string") return `${s.language === "python" ? "Python" : "JavaScript"} function they wrote:\n${clip(s.code)}`;
  if ((toolType === "devops_workspace" || toolType === "frontend_workspace") && Array.isArray(s.files)) return `Configuration they wrote:\n${clip((s.files as { name?: string; content?: string }[]).map((f) => `--- ${f.name} ---\n${f.content ?? ""}`).join("\n"))}`;
  if (toolType === "ml_workspace") {
    const answers = s.answers && typeof s.answers === "object" ? `\n\nNumbers they reported:\n${Object.entries(s.answers as Record<string, unknown>).map(([k, v]) => `${k}: ${String(v)}`).join("\n")}` : "";
    if (typeof s.code === "string") return `Python notebook they wrote:\n${clip(s.code)}${answers}`;
  }
  return clip(JSON.stringify(submission, null, 2));
}

const wordCount = (answers: readonly string[]) => answers.join(" ").split(/\s+/).filter(Boolean).length;

/** Pure. The highest score the answers could earn however good they sound: blank answers score 0, a few words at most 30. */
export function effortCap(answers: readonly string[]): number {
  const words = wordCount(answers);
  if (words === 0) return 0;
  return words < MIN_WORDS ? 30 : 100;
}

/** Pure. The AI's score, kept within 0-100 and never above what the effort allows. */
export function finalScore(aiScore: number, answers: readonly string[]): number {
  return Math.round(Math.max(0, Math.min(aiScore, effortCap(answers), 100)));
}

/** Pure. "award": rating given. "retry": below the mark with a try left. "close": below the mark, no tries left, closed without a rating. */
export function decideOutcome(score: number, attemptsUsed: number): "award" | "retry" | "close" {
  if (score >= PASS_SCORE) return "award";
  return attemptsUsed < MAX_ATTEMPTS ? "retry" : "close";
}

export interface TaskBrief {
  title: string;
  requester: string | null;
  scenario: string;
  objective: string;
  skill: string | null;
  difficulty: string;
  submission: string;
  /** the checks the task already passed, by label only */
  passedChecks: string[];
}
