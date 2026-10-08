/**
 * Confirms the AI setup end to end with one tiny request.   npm run ai:check
 * Reads .env.local (AI_PROVIDER, AWS_BEARER_TOKEN_BEDROCK, BEDROCK_MODEL_ID, BEDROCK_REGION, GROQ_API_KEY). Prints which providers it will try, the model that
 * answered and OK or the error: never a key.
 */
import { z } from "zod";
import { completeStructured, providerSetting, providersToTry } from "../lib/ai/provider";

try {
  console.log(`AI_PROVIDER=${providerSetting()}; will try: ${providersToTry().join(" then ") || "nothing (not configured)"}`);
  const out = await completeStructured({
    system: "Answer only by calling the tool.", user: "Reply with ok set to true.", toolName: "answer", toolDescription: "Return the result.",
    inputSchema: { type: "object", required: ["ok"], properties: { ok: { type: "boolean" } } }, schema: z.object({ ok: z.boolean() }), maxTokens: 50, temperature: 0,
  });
  console.log(out.value.ok ? `OK: ${out.model} answered (${out.usage.inputTokens} in, ${out.usage.outputTokens} out).` : `${out.model} answered, but not as asked.`);
} catch (error) {
  console.error("FAILED:", error instanceof Error ? error.message : "unknown error");
  process.exitCode = 1;
}
