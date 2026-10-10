/**
 * Confirms the AI setup end to end with one tiny request per provider.   npm run ai:check
 * Prints the primary and fallback route from the environment, then asks each to answer. Never prints a key.
 */
import { z } from "zod";
import { routeFor } from "../lib/ai/llm/config";
import { generateStructured } from "../lib/ai/llm";

const { primary, fallback } = routeFor("general");
console.log(`primary: ${primary.provider}/${primary.model}; fallback: ${fallback ? `${fallback.provider}/${fallback.model}` : "none"}`);
for (const [label, env] of [["primary", {}], ["fallback", { LLM_PROVIDER: fallback?.provider, LLM_MODEL: fallback?.model, LLM_FALLBACK_PROVIDER: "", LLM_FALLBACK_MODEL: "" }]] as const) {
  if (label === "fallback" && !fallback) continue;
  try {
    const out = await generateStructured({ task: "general", system: "Reply with the JSON object asked for.", user: "Reply with ok set to true.", schema: z.object({ ok: z.boolean() }), maxTokens: 50, promptVersion: "check.v1" }, { env: { ...process.env, ...env } });
    console.log(`${label}: OK (${out.provider}:${out.model})`);
  } catch (e) {
    console.log(`${label}: FAILED ${(e as Error).message.slice(0, 160)}`);
    process.exitCode = 1;
  }
}
