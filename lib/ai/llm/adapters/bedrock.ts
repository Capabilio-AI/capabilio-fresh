import { z } from "zod";
import { BedrockError, completeJson } from "@/lib/ai/bedrock";
import { LlmError, type LlmAdapter, type RawRequest, type RawResult } from "../types";

/**
 * The existing Bedrock client, exposed through the common adapter contract. It forces one tool call, so the reply is JSON;
 * the generic layer still validates it against the caller's zod schema.
 */
export const bedrockAdapter: LlmAdapter = {
  name: "bedrock",
  async complete(req: RawRequest): Promise<RawResult> {
    try {
      const out = await completeJson({
        system: req.system, user: req.user, toolName: "answer", toolDescription: "Return the structured answer.",
        inputSchema: req.jsonSchema, schema: z.unknown() as z.ZodType<unknown>, maxTokens: req.maxTokens, temperature: req.temperature,
      });
      return { text: JSON.stringify(out.value), usage: out.usage };
    } catch (e) {
      if (e instanceof BedrockError) throw new LlmError(e.retryable ? "provider_down" : "config", e.message, e);
      throw e;
    }
  },
};
