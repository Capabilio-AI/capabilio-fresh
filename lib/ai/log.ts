import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";
import type { Database } from "@/lib/supabase/types";
import { untyped } from "@/lib/org/db";
import { completeJsonDetailed, type TokenUsage } from "./groq";

type Service = SupabaseClient<Database>;
type Meta = Record<string, string | number | boolean | null>;

export type AiStatus = "ok" | "error" | "rate_limited" | "blocked";

export interface AiCallRecord {
  feature: string;
  userId: string | null;
  status: AiStatus;
  model?: string | null;
  latencyMs?: number | null;
  usage?: TokenUsage;
  error?: string | null;
  /** non-personal identifiers only (a node key, a topic id). Never prompt or response text. */
  meta?: Meta;
}

/**
 * Pure. Cost in cents from token use and per-million-token rates (cents). NULL when either the usage or a rate is unknown:
 * we do not guess a price. Rates come from the environment (AI_COST_INPUT_CENTS_PER_MTOK / AI_COST_OUTPUT_CENTS_PER_MTOK).
 */
export function estimateCostCents(usage: TokenUsage | undefined, rates: { inputPerMtok: number | null; outputPerMtok: number | null }): number | null {
  if (!usage || usage.promptTokens === null || usage.completionTokens === null || rates.inputPerMtok === null || rates.outputPerMtok === null) return null;
  return (usage.promptTokens * rates.inputPerMtok + usage.completionTokens * rates.outputPerMtok) / 1_000_000;
}

const rate = (v: string | undefined) => (v !== undefined && v !== "" && Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : null);
export const costRatesFromEnv = () => ({ inputPerMtok: rate(process.env.AI_COST_INPUT_CENTS_PER_MTOK), outputPerMtok: rate(process.env.AI_COST_OUTPUT_CENTS_PER_MTOK) });

/** Writes one row to ai_call_log. Logging must never break the feature it observes, so a failure is reported and swallowed. */
export async function logAiCall(service: Service, rec: AiCallRecord): Promise<void> {
  try {
    const { error } = await untyped(service).from("ai_call_log").insert({
      feature: rec.feature,
      user_id: rec.userId,
      status: rec.status,
      model: rec.model ?? null,
      latency_ms: rec.latencyMs ?? null,
      prompt_tokens: rec.usage?.promptTokens ?? null,
      completion_tokens: rec.usage?.completionTokens ?? null,
      total_tokens: rec.usage?.totalTokens ?? null,
      cost_cents_estimate: estimateCostCents(rec.usage, costRatesFromEnv()),
      error: rec.error ? rec.error.slice(0, 300) : null,
      meta: rec.meta ?? {},
    });
    if (error) console.error("[ai-log] insert failed:", error.message);
  } catch (e) {
    console.error("[ai-log] insert failed:", e);
  }
}

/** The one way new AI features call the model: same behaviour as completeJson, plus a log row (ok or error) with latency, tokens and cost. */
export async function loggedCompleteJson<T>(service: Service, ctx: { feature: string; userId: string | null; meta?: Meta }, prompt: string, system: string, schema: z.ZodType<T>): Promise<T> {
  const startedAt = Date.now();
  try {
    const out = await completeJsonDetailed(prompt, system, schema);
    await logAiCall(service, { ...ctx, status: "ok", model: out.model, latencyMs: out.latencyMs, usage: out.usage, meta: { ...ctx.meta, attempts: out.attempts } });
    return out.value;
  } catch (error) {
    await logAiCall(service, { ...ctx, status: "error", latencyMs: Date.now() - startedAt, error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}
