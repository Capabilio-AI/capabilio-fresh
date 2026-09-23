import Groq from "groq-sdk";
import type { z } from "zod";

// The brief specifies Llama 3.3 70B, but this Groq account's key has no
// Llama chat model available (only Prompt Guard classifiers) — confirmed
// live against /models. openai/gpt-oss-120b is the largest general chat
// model this key can actually reach, still served through Groq.
export const GROQ_MODEL = "openai/gpt-oss-120b";

const MAX_ATTEMPTS = 4;
const RATE_LIMIT_BACKOFF_MS = 15_000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let client: Groq | null = null;

/** Single shared Groq client — every AI call in this app (MCQ generation, Guide Path reasoning) goes through here. */
export function getGroqClient(): Groq {
  if (client) return client;
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("Missing required environment variable: GROQ_API_KEY");
  }
  client = new Groq({ apiKey });
  return client;
}

/**
 * Requests JSON matching `schema`, retrying with the validation error fed
 * back to the model — LLM JSON-mode output is not guaranteed to be valid
 * JSON (Groq's own validator can reject it) or to match the requested
 * shape on the first try, so this must self-correct rather than trust a
 * single response.
 */
export async function completeJson<T>(
  prompt: string,
  systemPrompt: string,
  schema: z.ZodType<T>
): Promise<T> {
  const groq = getGroqClient();
  const messages: Groq.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: prompt },
  ];

  let lastError = "";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (lastError) {
      messages.push({
        role: "user",
        content: `Your previous response was invalid: ${lastError}\nRespond again with corrected JSON only, matching the required shape exactly.`,
      });
    }

    let content: string | undefined;
    try {
      const completion = await groq.chat.completions.create({
        model: GROQ_MODEL,
        messages,
        response_format: { type: "json_object" },
        temperature: 0.4,
      });
      content = completion.choices[0]?.message?.content ?? undefined;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      // A questions-per-section generation runs close to this account's
      // per-minute token budget — a 429 here is expected occasionally, not
      // exceptional, so it must wait out the window rather than immediately
      // retry (which would just hit the same limit again).
      const status = (error as { status?: number })?.status;
      if (status === 429 && attempt < MAX_ATTEMPTS) {
        await sleep(RATE_LIMIT_BACKOFF_MS);
      }
      continue;
    }

    if (!content) {
      lastError = "empty response";
      continue;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      lastError = "response was not valid JSON";
      continue;
    }

    const result = schema.safeParse(parsed);
    if (result.success) return result.data;
    lastError = result.error.message;
  }

  throw new Error(`Groq did not return a valid response after ${MAX_ATTEMPTS} attempts: ${lastError}`);
}
