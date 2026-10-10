import { generateStructured } from "./llm";
import type { JsonRequest, JsonResult } from "./bedrock";

/**
 * Structured generation for roadmap-style callers that pass a tool-style request. It is the same layer as everything else
 * (lib/ai/llm): primary provider first, fallback second, both chosen by LLM_* environment variables. The model that actually answered
 * is returned as "provider:model" and stored with what it made, so a fallback is never silent.
 */
export async function completeStructured<T>(req: JsonRequest<T>): Promise<JsonResult<T>> {
  const out = await generateStructured({
    task: "general",
    system: req.system,
    user: req.user,
    schema: req.schema,
    temperature: req.temperature,
    maxTokens: req.maxTokens ?? 12_000,
    promptVersion: "structured.v1",
  });
  return { value: out.value, usage: out.usage, model: `${out.provider}:${out.model}` };
}
