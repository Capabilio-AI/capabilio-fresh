// Health check for the AI providers: calls every configured route (primary, fallback, second fallback) once with a tiny request and says
// which of them actually answer, how fast, and why not. Nothing is written and no key is ever printed.
//   npm run ai:check
import { z } from "zod";
import { generateStructured } from "@/lib/ai/llm";
import { routesFor } from "@/lib/ai/llm/config";
import { adapterFor } from "@/lib/ai/llm/registry";

const routes = routesFor("general");
const rows: { order: string; provider: string; model: string; result: string; ms: number | null }[] = [];
for (const [i, r] of routes.entries()) {
  const started = Date.now();
  try {
    const adapter = adapterFor(r.provider);
    const out = await adapter.complete({ model: r.model, system: "Answer with JSON only.", user: 'Return {"ok": true}', temperature: 0, maxTokens: 400, jsonSchema: z.toJSONSchema(z.object({ ok: z.boolean() })) as Record<string, unknown> });
    rows.push({ order: ["primary", "fallback", "fallback 2"][i] ?? `#${i}`, provider: r.provider, model: r.model, result: /ok/i.test(out.text) ? "ANSWERS" : `odd reply: ${out.text.slice(0, 60)}`, ms: Date.now() - started });
  } catch (e) {
    rows.push({ order: ["primary", "fallback", "fallback 2"][i] ?? `#${i}`, provider: r.provider, model: r.model, result: `FAILS: ${(e as Error).message.slice(0, 160)}`, ms: null });
  }
}
console.table(rows);
const working = rows.filter((r) => r.result === "ANSWERS").length;
console.log(working === rows.length ? "All configured providers answer." : working === 0 ? "NO provider answers: AI features are down." : `${rows.length - working} of ${rows.length} providers are failing; the app is running on the rest.`);
if (rows[0]?.result !== "ANSWERS") console.log("The PRIMARY provider is not answering, so every call is being served by a fallback.");
// the real path, end to end
try {
  const out = await generateStructured({ task: "general", system: "Answer with JSON only.", user: 'Return {"ok": true}', schema: z.object({ ok: z.boolean() }), maxTokens: 400, temperature: 0, promptVersion: "check" });
  console.log(`generateStructured answered via ${out.provider}:${out.model}`);
} catch (e) {
  console.log(`generateStructured FAILED: ${(e as Error).message.slice(0, 200)}`);
}
