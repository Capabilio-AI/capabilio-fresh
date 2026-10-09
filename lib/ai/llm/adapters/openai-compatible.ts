import { LlmError, type LlmAdapter, type RawRequest, type RawResult } from "../types";

export type JsonMode = "json_object" | "json_schema" | "prompt";

export interface OpenAiCompatibleOptions {
  name: string;
  baseUrl: string;
  apiKey: string;
  /** json_object: Groq/OpenAI JSON mode. json_schema: strict structured outputs. prompt: ask for JSON in text, validate after. */
  jsonMode: JsonMode;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  /** provider quirks that belong to the wire, not to business code (e.g. reasoning effort for a model family) */
  extraBody?: (model: string) => Record<string, unknown>;
}

/**
 * Any OpenAI-style /chat/completions endpoint (Groq, OpenAI, Together, OpenRouter, vLLM, ...). Most future models are therefore an env
 * change: OPENAI_COMPAT_BASE_URL + OPENAI_COMPAT_API_KEY (+ OPENAI_COMPAT_JSON_MODE) with LLM_PROVIDER=openai-compatible.
 */
export function openAiCompatible(o: OpenAiCompatibleOptions): LlmAdapter {
  const doFetch = o.fetchImpl ?? fetch;
  return {
    name: o.name,
    async complete(req: RawRequest): Promise<RawResult> {
      const jsonInstruction = `\n\nReturn ONLY one JSON object (no prose, no code fences) matching this JSON Schema:\n${JSON.stringify(req.jsonSchema)}`;
      const body: Record<string, unknown> = {
        model: req.model,
        messages: [
          { role: "system", content: req.system },
          { role: "user", content: o.jsonMode === "prompt" ? req.user + jsonInstruction : req.user },
        ],
        temperature: req.temperature,
        max_tokens: req.maxTokens,
        ...(o.extraBody?.(req.model) ?? {}),
      };
      if (o.jsonMode === "json_object") {
        body.response_format = { type: "json_object" };
        body.messages = [{ role: "system", content: req.system }, { role: "user", content: req.user + jsonInstruction }];
      } else if (o.jsonMode === "json_schema") {
        body.response_format = { type: "json_schema", json_schema: { name: "result", schema: req.jsonSchema, strict: false } };
      }

      let res: Response;
      try {
        res = await doFetch(`${o.baseUrl.replace(/\/$/, "")}/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${o.apiKey}` },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(o.timeoutMs ?? 90_000),
        });
      } catch (e) {
        const timedOut = (e as Error)?.name === "TimeoutError" || (e as Error)?.name === "AbortError";
        throw new LlmError(timedOut ? "timeout" : "provider_down", `${o.name}: ${timedOut ? "request timed out" : "could not be reached"}`, e);
      }
      if (res.status === 429) {
        const secs = Number(res.headers.get("retry-after"));
        throw new LlmError("rate_limit", `${o.name}: rate limited`, undefined, Number.isFinite(secs) && secs >= 0 ? secs * 1000 : undefined);
      }
      if (res.status === 408) throw new LlmError("timeout", `${o.name}: request timed out`);
      if (res.status >= 500) throw new LlmError("provider_down", `${o.name}: unavailable (${res.status})`);
      if (!res.ok) {
        const detail = (await res.text().catch(() => "")).slice(0, 400);
        // JSON mode that could not produce valid JSON (typically a reasoning model that ran out of tokens) is a bad ANSWER, which a
        // repair/retry can fix, not a bad REQUEST.
        if (res.status === 400 && /json_validate_failed|failed to (validate|generate) json/i.test(detail)) throw new LlmError("invalid_output", `${o.name}: could not produce valid JSON`);
        throw new LlmError("config", `${o.name}: rejected the request (${res.status}) ${detail.slice(0, 200)}`);
      }
      const data = (await res.json().catch(() => null)) as { choices?: { message?: { content?: string } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } } | null;
      const text = data?.choices?.[0]?.message?.content;
      if (!text) throw new LlmError("invalid_output", `${o.name}: empty response`);
      return { text, usage: { inputTokens: data?.usage?.prompt_tokens ?? null, outputTokens: data?.usage?.completion_tokens ?? null } };
    },
  };
}
