import { LlmError, type LlmAdapter, type RawRequest, type RawResult } from "../types";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const TIMEOUT_MS = 120_000;

interface MessagesResponse {
  content?: { type: string; input?: unknown }[];
  stop_reason?: string;
  usage?: { input_tokens?: number; output_tokens?: number };
}

export interface AnthropicOptions {
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

/**
 * Claude through the Anthropic Messages API. The model is forced to answer through ONE tool, so the reply is structured JSON (the generic
 * layer still validates it against the caller's schema). Amazon Bedrock speaks the same protocol (see ./bedrock.ts): moving to Bedrock is
 * LLM_FALLBACK_PROVIDER=bedrock plus BEDROCK_MODEL_ID, no code change.
 */
export function anthropicAdapter(o: AnthropicOptions): LlmAdapter {
  const doFetch = o.fetchImpl ?? fetch;
  return {
    name: "anthropic",
    async complete(req: RawRequest): Promise<RawResult> {
      let res: Response;
      try {
        res = await doFetch(o.baseUrl || ANTHROPIC_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": o.apiKey, "anthropic-version": "2023-06-01" },
          body: JSON.stringify({
            model: req.model,
            max_tokens: req.maxTokens,
            temperature: req.temperature,
            system: req.system,
            messages: [{ role: "user", content: req.user }],
            tools: [{ name: "answer", description: "Return the structured answer.", input_schema: req.jsonSchema }],
            tool_choice: { type: "tool", name: "answer" },
          }),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
      } catch (e) {
        const timedOut = (e as Error)?.name === "TimeoutError" || (e as Error)?.name === "AbortError";
        throw new LlmError(timedOut ? "timeout" : "provider_down", `anthropic: ${timedOut ? "request timed out" : "could not be reached"}`, e);
      }
      if (res.status === 429) {
        const secs = Number(res.headers.get("retry-after"));
        throw new LlmError("rate_limit", "anthropic: rate limited", undefined, Number.isFinite(secs) && secs >= 0 ? secs * 1000 : undefined);
      }
      if (res.status >= 500) throw new LlmError("provider_down", `anthropic: unavailable (${res.status})`); // includes 529 overloaded
      if (!res.ok) {
        const detail = (await res.text().catch(() => "")).slice(0, 300);
        throw new LlmError("config", `anthropic: rejected the request (${res.status}) ${detail}`);
      }
      const data = (await res.json().catch(() => null)) as MessagesResponse | null;
      const tool = data?.content?.find((c) => c.type === "tool_use");
      if (!tool?.input) throw new LlmError("invalid_output", `anthropic: no answer returned (${data?.stop_reason ?? "unknown"})`);
      return { text: JSON.stringify(tool.input), usage: { inputTokens: data?.usage?.input_tokens ?? null, outputTokens: data?.usage?.output_tokens ?? null } };
    },
  };
}
