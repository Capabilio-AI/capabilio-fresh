import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { BedrockError, BedrockOutputError, type JsonRequest } from "./bedrock";
import { completeStructured, providersToTry } from "./provider";

const env = (o: Record<string, string>) => o as unknown as NodeJS.ProcessEnv;
const BOTH = { AWS_BEARER_TOKEN_BEDROCK: "k", BEDROCK_MODEL_ID: "m", GROQ_API_KEY: "g" };
const req: JsonRequest<{ ok: boolean }> = { system: "s", user: "u", toolName: "t", toolDescription: "d", inputSchema: { type: "object" }, schema: z.object({ ok: z.boolean() }) };
const ok = (model: string) => vi.fn().mockResolvedValue({ value: { ok: true }, usage: { inputTokens: 1, outputTokens: 1 }, model });

describe("providersToTry", () => {
  it("auto uses what is configured, Bedrock first", () => {
    expect(providersToTry(env(BOTH))).toEqual(["bedrock", "groq"]);
    expect(providersToTry(env({ GROQ_API_KEY: "g" }))).toEqual(["groq"]);
    expect(providersToTry(env({ AWS_BEARER_TOKEN_BEDROCK: "k", BEDROCK_MODEL_ID: "m" }))).toEqual(["bedrock"]);
    expect(providersToTry(env({ AWS_BEARER_TOKEN_BEDROCK: "k" }))).toEqual([]);
  });
  it("an explicit setting pins one provider", () => {
    expect(providersToTry(env({ ...BOTH, AI_PROVIDER: "groq" }))).toEqual(["groq"]);
    expect(providersToTry(env({ ...BOTH, AI_PROVIDER: "BEDROCK" }))).toEqual(["bedrock"]);
    expect(providersToTry(env({ ...BOTH, AI_PROVIDER: "nonsense" }))).toEqual(["bedrock", "groq"]);
  });
});

describe("completeStructured", () => {
  it("uses Bedrock when it works and never calls Groq", async () => {
    const bedrock = ok("claude"); const groq = ok("groq:x");
    expect((await completeStructured(req, { env: env(BOTH), bedrock, groq })).model).toBe("claude");
    expect(groq).not.toHaveBeenCalled();
  });
  it("falls back to Groq, loudly, when AWS refuses the request", async () => {
    const bedrock = vi.fn().mockRejectedValue(new BedrockError("Bedrock rejected the request (400): Operation not allowed"));
    const warn = vi.fn();
    const out = await completeStructured(req, { env: env(BOTH), bedrock, groq: ok("groq:x"), warn });
    expect(out.model).toBe("groq:x");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("falling back to groq"));
  });
  it("does not fall back when the model answered but the answer was unusable", async () => {
    const bedrock = vi.fn().mockRejectedValue(new BedrockOutputError("did not match the expected shape"));
    const groq = ok("groq:x");
    await expect(completeStructured(req, { env: env(BOTH), bedrock, groq })).rejects.toBeInstanceOf(BedrockOutputError);
    expect(groq).not.toHaveBeenCalled();
  });
  it("does not fall back when Bedrock is pinned, and fails clearly when nothing is configured", async () => {
    const bedrock = vi.fn().mockRejectedValue(new BedrockError("Operation not allowed"));
    await expect(completeStructured(req, { env: env({ ...BOTH, AI_PROVIDER: "bedrock" }), bedrock, groq: ok("g") })).rejects.toThrow(/Operation not allowed/);
    await expect(completeStructured(req, { env: env({}) })).rejects.toThrow(/No AI provider is configured/);
  });
});
