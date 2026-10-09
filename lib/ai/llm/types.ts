import type { z } from "zod";

/**
 * The ONE structured-generation contract for questions, role profiles and feedback. Business code depends on this file only;
 * everything provider-specific lives in an adapter. The older completeStructured() in ../provider.ts (roadmap generation) is left
 * as a facade and is not a second abstraction: it predates this and is migrated by adding a task, not by changing callers.
 */
export type LlmTask = "question" | "question_verify" | "feedback" | "role_profile" | "role_resolve";

export type LlmErrorKind = "rate_limit" | "timeout" | "invalid_output" | "provider_down" | "config";

export class LlmError extends Error {
  constructor(readonly kind: LlmErrorKind, message: string, readonly cause?: unknown, readonly retryAfterMs?: number) {
    super(message);
  }
  get retryable() {
    return this.kind === "rate_limit" || this.kind === "timeout" || this.kind === "provider_down";
  }
}

export interface StructuredRequest<T> {
  task: LlmTask;
  system: string;
  user: string;
  schema: z.ZodType<T>;
  temperature?: number;
  maxTokens?: number;
  /** which versioned prompt produced system/user; echoed back so it can be stored beside what the model made */
  promptVersion: string;
}

export interface StructuredResult<T> {
  value: T;
  provider: string;
  model: string;
  promptVersion: string;
  usage: { inputTokens: number | null; outputTokens: number | null };
}

/** What an adapter receives: provider-neutral, with a JSON Schema for adapters that can use one. */
export interface RawRequest {
  model: string;
  system: string;
  user: string;
  temperature: number;
  maxTokens: number;
  jsonSchema: Record<string, unknown>;
}
export interface RawResult {
  text: string;
  usage: { inputTokens: number | null; outputTokens: number | null };
}

/**
 * Adding a provider means writing one of these and registering it. Adapters translate transport errors into LlmError and own every
 * provider quirk (JSON mode vs json_schema vs prompt-then-validate). They never validate business shapes.
 */
export interface LlmAdapter {
  readonly name: string;
  complete(req: RawRequest): Promise<RawResult>;
}

export interface ModelRoute {
  provider: string;
  model: string;
}
