import { BedrockError, BedrockOutputError, completeJson as bedrockJson, type JsonRequest, type JsonResult } from "./bedrock";
import { GROQ_MODEL, completeJsonDetailed as groqJson } from "./groq";

/**
 * Which model answers structured requests.
 *   AI_PROVIDER=bedrock   Claude on Amazon Bedrock only
 *   AI_PROVIDER=groq      Groq only
 *   AI_PROVIDER=auto      (default) Bedrock when configured; if AWS refuses or is unreachable, Groq when configured
 * The model that actually answered is returned (and stored with what it made), so a fallback is never silent.
 */
export type Provider = "bedrock" | "groq";
export type ProviderSetting = Provider | "auto";

export function providerSetting(env: NodeJS.ProcessEnv = process.env): ProviderSetting {
  const v = (env.AI_PROVIDER ?? "auto").trim().toLowerCase();
  return v === "bedrock" || v === "groq" ? v : "auto";
}

export const bedrockConfigured = (env: NodeJS.ProcessEnv = process.env) => Boolean(env.AWS_BEARER_TOKEN_BEDROCK && env.BEDROCK_MODEL_ID);
export const groqConfigured = (env: NodeJS.ProcessEnv = process.env) => Boolean(env.GROQ_API_KEY);

/** Pure. The providers to try, in order. Empty means nothing is configured. */
export function providersToTry(env: NodeJS.ProcessEnv = process.env): Provider[] {
  const setting = providerSetting(env);
  if (setting === "bedrock") return ["bedrock"];
  if (setting === "groq") return ["groq"];
  return [...(bedrockConfigured(env) ? (["bedrock"] as const) : []), ...(groqConfigured(env) ? (["groq"] as const) : [])];
}

async function viaGroq<T>(req: JsonRequest<T>): Promise<JsonResult<T>> {
  // Groq's JSON mode has no forced tool, so the schema travels in the prompt and the zod schema stays the real gate
  const user = [req.user, "", "Return ONLY one JSON object (no prose, no code fences) that matches this JSON Schema:", JSON.stringify(req.inputSchema)].join("\n");
  const out = await groqJson(user, req.system, req.schema);
  return { value: out.value, usage: { inputTokens: out.usage.promptTokens, outputTokens: out.usage.completionTokens }, model: `groq:${GROQ_MODEL}` };
}

export interface ProviderDeps {
  env?: NodeJS.ProcessEnv;
  bedrock?: typeof bedrockJson;
  groq?: typeof viaGroq;
  warn?: (message: string) => void;
}

export async function completeStructured<T>(req: JsonRequest<T>, deps: ProviderDeps = {}): Promise<JsonResult<T>> {
  const env = deps.env ?? process.env;
  const run = { bedrock: deps.bedrock ?? bedrockJson, groq: deps.groq ?? viaGroq };
  const order = providersToTry(env);
  if (order.length === 0) throw new Error("No AI provider is configured: set AWS_BEARER_TOKEN_BEDROCK and BEDROCK_MODEL_ID, or GROQ_API_KEY.");
  let last: unknown;
  for (const [i, provider] of order.entries()) {
    try {
      return await run[provider](req);
    } catch (error) {
      last = error;
      // an unusable answer is not a provider problem; only "AWS refused or is unreachable" moves on to the next provider
      const unavailable = provider === "bedrock" && error instanceof BedrockError && !(error instanceof BedrockOutputError);
      if (!unavailable || i === order.length - 1) throw error;
      (deps.warn ?? console.warn)(`[ai] Bedrock unavailable, falling back to ${order[i + 1]}: ${error.message.slice(0, 160)}`);
    }
  }
  throw last;
}
