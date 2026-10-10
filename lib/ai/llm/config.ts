import type { LlmTask, ModelRoute } from "./types";

type Env = Record<string, string | undefined>;

const TASK_PREFIX: Record<LlmTask, string> = {
  question: "QUESTION",
  question_verify: "QUESTION",
  feedback: "FEEDBACK",
  role_profile: "ROLE_PROFILE",
  role_resolve: "ROLE_PROFILE",
  challenge: "CHALLENGE",
  challenge_verify: "CHALLENGE",
};

// openai/gpt-oss-120b is the largest chat model this account's Groq key can reach (see lib/ai/groq.ts).
const DEFAULT_MODEL = "openai/gpt-oss-120b";

/**
 * Env-only routing. Precedence for a task: <TASK>_PROVIDER/<TASK>_MODEL, then LLM_PROVIDER/LLM_MODEL (GROQ_MODEL still honoured as
 * the legacy name), then groq + the default model. The fallback route follows the same shape with *_FALLBACK_* names.
 */
export function routeFor(task: LlmTask, env: Env = process.env): { primary: ModelRoute; fallback: ModelRoute | null } {
  const p = TASK_PREFIX[task];
  const provider = (env[`${p}_PROVIDER`] || env.LLM_PROVIDER || "groq").trim().toLowerCase();
  const model = (env[`${p}_MODEL`] || env.LLM_MODEL || (provider === "groq" ? env.GROQ_MODEL : "") || (provider === "groq" ? DEFAULT_MODEL : "")).trim();
  const fbProvider = (env[`${p}_FALLBACK_PROVIDER`] || env.LLM_FALLBACK_PROVIDER || (env.GROQ_FALLBACK_MODEL ? "groq" : "")).trim().toLowerCase();
  const fbModel = (env[`${p}_FALLBACK_MODEL`] || env.LLM_FALLBACK_MODEL || env.GROQ_FALLBACK_MODEL || "").trim();
  const primary = { provider, model };
  const fallback = fbProvider && fbModel && (fbProvider !== provider || fbModel !== model) ? { provider: fbProvider, model: fbModel } : null;
  return { primary, fallback };
}
