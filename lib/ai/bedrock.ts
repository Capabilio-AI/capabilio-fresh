import type { z } from "zod";

/**
 * Claude on Amazon Bedrock through the Anthropic Messages route of the bedrock-runtime endpoint (the newest Claude models are not offered on Converse),
 * authenticated with a Bedrock API key. The model is forced to answer through ONE tool, so the reply is structured JSON that is then validated
 * against a zod schema: model output is data, never trusted code or SQL.
 *
 *   AWS_BEARER_TOKEN_BEDROCK  the Bedrock API key (server only)
 *   BEDROCK_MODEL_ID          model or inference-profile id the key can invoke (required)
 *   BEDROCK_REGION            defaults to us-east-1
 */
export class BedrockError extends Error {
  constructor(message: string, readonly retryable = false) {
    super(message);
  }
}

/** The model answered but its answer was unusable (cut off, no tool call, wrong shape). A different provider would not fix the request, so this never triggers a fallback. */
export class BedrockOutputError extends BedrockError {}

export interface BedrockConfig {
  apiKey: string;
  modelId: string;
  region: string;
}

export function bedrockConfig(env: NodeJS.ProcessEnv = process.env): BedrockConfig {
  const apiKey = env.AWS_BEARER_TOKEN_BEDROCK;
  const modelId = env.BEDROCK_MODEL_ID;
  if (!apiKey) throw new BedrockError("Missing required environment variable: AWS_BEARER_TOKEN_BEDROCK");
  if (!modelId) throw new BedrockError("Missing required environment variable: BEDROCK_MODEL_ID");
  return { apiKey, modelId, region: env.BEDROCK_REGION || "us-east-1" };
}

export interface JsonRequest<T> {
  system: string;
  user: string;
  /** the tool the model must call; its name is only a label */
  toolName: string;
  toolDescription: string;
  /** JSON Schema of the tool input; the zod schema below is the real gate */
  inputSchema: Record<string, unknown>;
  schema: z.ZodType<T>;
  maxTokens?: number;
  temperature?: number;
}

export interface JsonResult<T> {
  value: T;
  usage: { inputTokens: number | null; outputTokens: number | null };
  model: string;
}

const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [2_000, 6_000];
const REQUEST_TIMEOUT_MS = 240_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface MessagesResponse {
  content?: { type: string; name?: string; input?: unknown }[];
  stop_reason?: string;
  usage?: { input_tokens?: number; output_tokens?: number };
}

export async function completeJson<T>(req: JsonRequest<T>, deps: { config?: BedrockConfig; fetchImpl?: typeof fetch; wait?: (ms: number) => Promise<void> } = {}): Promise<JsonResult<T>> {
  const config = deps.config ?? bedrockConfig();
  const doFetch = deps.fetchImpl ?? fetch;
  const wait = deps.wait ?? sleep;
  const url = `https://bedrock-runtime.${config.region}.amazonaws.com/anthropic/v1/messages`;
  const body = JSON.stringify({
    model: config.modelId,
    max_tokens: req.maxTokens ?? 12_000,
    temperature: req.temperature ?? 0.3,
    system: req.system,
    messages: [{ role: "user", content: req.user }],
    tools: [{ name: req.toolName, description: req.toolDescription, input_schema: req.inputSchema }],
    tool_choice: { type: "tool", name: req.toolName },
  });

  let last: BedrockError | null = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) await wait(BACKOFF_MS[attempt - 1] ?? 6_000);
    let res: Response;
    try {
      res = await doFetch(url, { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": config.apiKey, "anthropic-version": "2023-06-01" }, body, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    } catch {
      last = new BedrockError("Could not reach Bedrock.", true);
      continue;
    }
    if (res.status === 429 || res.status >= 500) {
      last = new BedrockError(`Bedrock is busy or unavailable (${res.status}).`, true);
      continue;
    }
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new BedrockError(`Bedrock rejected the request (${res.status}): ${detail.slice(0, 300)}`);
    }
    const data = (await res.json().catch(() => null)) as MessagesResponse | null;
    if (data?.stop_reason === "max_tokens") throw new BedrockOutputError("The model's answer was cut off. Ask for less per call.");
    const tool = data?.content?.find((c) => c.type === "tool_use" && c.name === req.toolName);
    if (!tool) throw new BedrockOutputError("The model did not return structured output.");
    const parsed = req.schema.safeParse(tool.input);
    if (!parsed.success) throw new BedrockOutputError(`The model's output did not match the expected shape: ${parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
    return { value: parsed.data, usage: { inputTokens: data?.usage?.input_tokens ?? null, outputTokens: data?.usage?.output_tokens ?? null }, model: config.modelId };
  }
  throw last ?? new BedrockError("Bedrock failed.");
}
