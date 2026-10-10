import Groq from "groq-sdk";
import type { z } from "zod";
import { generateStructured } from "./llm";

// The brief specifies Llama 3.3 70B, but this Groq account's key has no
// Llama chat model available (only Prompt Guard classifiers) — confirmed
// live against /models. openai/gpt-oss-120b is the largest general chat
// model this key can actually reach, still served through Groq.
export const GROQ_MODEL = "openai/gpt-oss-120b";

let client: Groq | null = null;

/** The raw Groq client, for the one feature that streams chat (mentor). Structured JSON never uses it: see completeJsonDetailed. */
export function getGroqClient(): Groq {
  if (client) return client;
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("Missing required environment variable: GROQ_API_KEY");
  }
  client = new Groq({ apiKey });
  return client;
}

export interface TokenUsage {
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
}
export interface JsonCompletion<T> {
  value: T;
  usage: TokenUsage;
  model: string;
  attempts: number;
  latencyMs: number;
}

/**
 * Structured JSON for every feature that is not the question/feedback/challenge pipeline (roadmap, guide path, interviews, curriculum
 * extraction...). It goes through the one provider layer (lib/ai/llm): the primary provider answers, the fallback takes over when it is
 * rate limited or down, and nothing here knows which is which. Provider and model come from LLM_PROVIDER/LLM_MODEL and
 * LLM_FALLBACK_PROVIDER/LLM_FALLBACK_MODEL (Claude first, Groq second; Amazon Bedrock is a provider switch). `model` reports who answered.
 */
export async function completeJsonDetailed<T>(
  prompt: string,
  systemPrompt: string,
  schema: z.ZodType<T>,
  opts: { maxTokens?: number; temperature?: number; task?: "general" | "arena_task" } = {}
): Promise<JsonCompletion<T>> {
  const startedAt = Date.now();
  const out = await generateStructured({ task: opts.task ?? "general", system: systemPrompt, user: prompt, schema, maxTokens: opts.maxTokens ?? 6000, temperature: opts.temperature ?? 0.4, promptVersion: "general.v1" });
  const { inputTokens, outputTokens } = out.usage;
  return {
    value: out.value,
    usage: { promptTokens: inputTokens, completionTokens: outputTokens, totalTokens: inputTokens !== null && outputTokens !== null ? inputTokens + outputTokens : null },
    model: `${out.provider}:${out.model}`,
    attempts: 1,
    latencyMs: Date.now() - startedAt,
  };
}

/** Same as completeJsonDetailed, for callers that only need the value. */
export async function completeJson<T>(prompt: string, systemPrompt: string, schema: z.ZodType<T>, opts: { task?: "general" | "arena_task" } = {}): Promise<T> {
  return (await completeJsonDetailed(prompt, systemPrompt, schema, opts)).value;
}
