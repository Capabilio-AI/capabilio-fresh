import { CIRCULAR_SYSTEM, CircularDraftSchema, type CircularDraft } from "./circular";

const URL = "https://api.anthropic.com/v1/messages";
/** Reading a scanned page needs an image-capable model; the text pipeline (lib/ai/llm) takes text only. */
const MODEL = process.env.CIRCULAR_VISION_MODEL || "claude-sonnet-5-5";

/** Reads a scanned circular (page 1 as a PNG). Returns null when there is no key or the model gave nothing usable; the college then types it. */
export async function readCircularImage(png: Uint8Array): Promise<CircularDraft | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  const res = await fetch(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1500,
      system: CIRCULAR_SYSTEM,
      messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: "image/png", data: Buffer.from(png).toString("base64") } }, { type: "text", text: "Read this circular. Reply with the JSON object only." }] }],
    }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) return null;
  const data = (await res.json().catch(() => null)) as { content?: { type: string; text?: string }[] } | null;
  const reply = data?.content?.find((c) => c.type === "text")?.text ?? "";
  const json = reply.slice(reply.indexOf("{"), reply.lastIndexOf("}") + 1);
  try {
    const parsed = CircularDraftSchema.safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
