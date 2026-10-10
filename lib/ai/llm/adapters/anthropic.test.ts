import { describe, expect, it } from "vitest";
import { anthropicAdapter } from "./anthropic";
import { LlmError } from "../types";

const req = { model: "claude-haiku-5-5", system: "s", user: "u", temperature: 0.2, maxTokens: 100, jsonSchema: { type: "object" } };
const reply = (status: number, body: unknown, headers: Record<string, string> = {}) => (async () => new Response(JSON.stringify(body), { status, headers })) as unknown as typeof fetch;

describe("anthropicAdapter", () => {
  it("forces one tool call and returns its input as JSON text", async () => {
    let sent: { model: string; tool_choice: unknown } | null = null;
    const f = (async (_u: unknown, init: RequestInit) => { sent = JSON.parse(init.body as string); return new Response(JSON.stringify({ content: [{ type: "tool_use", input: { a: 1 } }], usage: { input_tokens: 5, output_tokens: 7 } })); }) as unknown as typeof fetch;
    const out = await anthropicAdapter({ apiKey: "k", fetchImpl: f }).complete(req);
    expect(JSON.parse(out.text)).toEqual({ a: 1 });
    expect(out.usage).toEqual({ inputTokens: 5, outputTokens: 7 });
    expect(sent!.model).toBe("claude-haiku-5-5");
    expect(sent!.tool_choice).toEqual({ type: "tool", name: "answer" });
  });

  it("maps 429 to a retryable rate_limit, 529 to provider_down, 401 to config, and no tool call to invalid_output", async () => {
    const kind = async (f: typeof fetch) => (await anthropicAdapter({ apiKey: "k", fetchImpl: f }).complete(req).catch((e: LlmError) => e) as LlmError).kind;
    expect(await kind(reply(429, {}, { "retry-after": "3" }))).toBe("rate_limit");
    expect(await kind(reply(529, {}))).toBe("provider_down");
    expect(await kind(reply(401, { error: "bad key" }))).toBe("config");
    expect(await kind(reply(200, { content: [{ type: "text" }], stop_reason: "max_tokens" }))).toBe("invalid_output");
  });
});
