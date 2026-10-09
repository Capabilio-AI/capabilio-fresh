import { z } from "zod";
import { routeFor } from "./config";
import { Limiter, backoffDelay, type Backoff } from "./limiter";
import { adapterFor } from "./registry";
import { LlmError, type StructuredRequest, type StructuredResult, type ModelRoute } from "./types";

export * from "./types";
export { registerAdapter, setAdapterForTest } from "./registry";
export { routeFor } from "./config";
export { mockAdapter } from "./adapters/mock";

const sharedLimiter = new Limiter(Math.max(1, Number(process.env.LLM_MAX_CONCURRENCY ?? process.env.GROQ_MAX_CONCURRENCY) || 1));
const sleepReal = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export interface GenerateDeps {
  env?: Record<string, string | undefined>;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
  limiter?: Limiter;
  /** transport attempts per route before moving to the fallback route */
  attempts?: number;
  /** extra tries when the model answers but the answer fails validation (the error is fed back) */
  repairs?: number;
  backoff?: Partial<Backoff>;
}

/**
 * generateStructured: validated JSON out, whatever the provider. Queueing, exponential backoff with jitter, fallback route and
 * validation-repair live here, once; adapters only talk to the wire. Throws LlmError with a stable `kind`.
 */
export async function generateStructured<T>(req: StructuredRequest<T>, deps: GenerateDeps = {}): Promise<StructuredResult<T>> {
  const env = deps.env ?? process.env;
  const sleep = deps.sleep ?? sleepReal;
  const limiter = deps.limiter ?? sharedLimiter;
  const attempts = deps.attempts ?? 4;
  const backoff: Backoff = { random: deps.random ?? Math.random, baseDelayMs: 1500, maxDelayMs: 30_000, ...deps.backoff };
  const { primary, fallback } = routeFor(req.task, env);
  const jsonSchema = z.toJSONSchema(req.schema) as Record<string, unknown>;

  let last: LlmError | null = null;
  for (const route of [primary, ...(fallback ? [fallback] : [])] as ModelRoute[]) {
    let user = req.user;
    let repairsLeft = deps.repairs ?? 2;
    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        const adapter = adapterFor(route.provider, env);
        const raw = await limiter.run(() => adapter.complete({ model: route.model, system: req.system, user, temperature: req.temperature ?? 0.6, maxTokens: req.maxTokens ?? 3000, jsonSchema }));
        const parsed = parse(req, raw.text);
        if (parsed.ok) return { value: parsed.value, provider: route.provider, model: route.model, promptVersion: req.promptVersion, usage: raw.usage };
        last = new LlmError("invalid_output", `${route.provider}: ${parsed.reason}`);
        if (repairsLeft-- <= 0) break;
        user = `${req.user}\n\nYour previous reply was invalid (${parsed.reason}). Reply again with corrected JSON only.`;
      } catch (e) {
        const err = e instanceof LlmError ? e : new LlmError("provider_down", (e as Error)?.message ?? "unknown error", e);
        last = err;
        if (err.kind === "invalid_output") { // the provider itself could not produce valid JSON: same remedy as a failed validation
          if (repairsLeft-- <= 0) break;
          continue;
        }
        if (!err.retryable) break; // config errors (bad key, unknown provider) will not improve by waiting
        // A quota that resets in minutes (a daily token cap) is not worth sleeping on: fail over or surface it now.
        if (err.kind === "rate_limit" && (err.retryAfterMs ?? 0) > backoff.maxDelayMs) break;
        if (attempt < attempts - 1) await sleep(backoffDelay(attempt, err, backoff));
      }
    }
  }
  throw last ?? new LlmError("provider_down", "No provider answered");
}

function parse<T>(req: StructuredRequest<T>, text: string): { ok: true; value: T } | { ok: false; reason: string } {
  let json: unknown;
  try {
    json = JSON.parse(text.trim().replace(/^```(?:json)?\s*|\s*```$/g, ""));
  } catch {
    return { ok: false, reason: "not valid JSON" };
  }
  const r = req.schema.safeParse(json);
  return r.success ? { ok: true, value: r.data } : { ok: false, reason: r.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
}
