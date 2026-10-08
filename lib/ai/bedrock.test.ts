import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { BedrockError, bedrockConfig, completeJson } from "./bedrock";

const config = { apiKey: "test-key", modelId: "us.anthropic.claude-test-v1:0", region: "us-east-1" };
const req = { system: "s", user: "u", toolName: "answer", toolDescription: "d", inputSchema: { type: "object" }, schema: z.object({ ok: z.boolean() }) };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const toolReply = (input: unknown) => reply({ content: [{ type: "tool_use", name: "answer", input }], usage: { input_tokens: 10, output_tokens: 5 } });

describe("bedrockConfig", () => {
  it("needs the API key and a model id, and defaults the region", () => {
    expect(() => bedrockConfig({} as NodeJS.ProcessEnv)).toThrow(/AWS_BEARER_TOKEN_BEDROCK/);
    expect(() => bedrockConfig({ AWS_BEARER_TOKEN_BEDROCK: "k" } as unknown as NodeJS.ProcessEnv)).toThrow(/BEDROCK_MODEL_ID/);
    expect(bedrockConfig({ AWS_BEARER_TOKEN_BEDROCK: "k", BEDROCK_MODEL_ID: "m" } as unknown as NodeJS.ProcessEnv)).toEqual({ apiKey: "k", modelId: "m", region: "us-east-1" });
  });
});

describe("completeJson", () => {
  it("sends an Anthropic Messages request with the API key and a forced tool, and returns validated output", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(toolReply({ ok: true }));
    const out = await completeJson(req, { config, fetchImpl });
    expect(out.value).toEqual({ ok: true });
    expect(out.usage).toEqual({ inputTokens: 10, outputTokens: 5 });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://bedrock-runtime.us-east-1.amazonaws.com/anthropic/v1/messages");
    expect(init.headers["x-api-key"]).toBe("test-key");
    expect(init.headers["anthropic-version"]).toBe("2023-06-01");
    const sent = JSON.parse(init.body);
    expect(sent.model).toBe("us.anthropic.claude-test-v1:0");
    expect(sent.tool_choice).toEqual({ type: "tool", name: "answer" });
  });
  it("retries a 429 and then succeeds", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(reply({}, 429)).mockResolvedValueOnce(toolReply({ ok: true }));
    const wait = vi.fn().mockResolvedValue(undefined);
    expect((await completeJson(req, { config, fetchImpl, wait })).value).toEqual({ ok: true });
    expect(wait).toHaveBeenCalledTimes(1);
  });
  it("gives up after repeated 5xx", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(reply({}, 503));
    await expect(completeJson(req, { config, fetchImpl, wait: async () => {} })).rejects.toBeInstanceOf(BedrockError);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
  it("does not retry a rejected request", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(reply({ message: "no access to model" }, 403));
    await expect(completeJson(req, { config, fetchImpl })).rejects.toThrow(/403/);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it("rejects output that does not match the schema, and a truncated answer", async () => {
    await expect(completeJson(req, { config, fetchImpl: vi.fn().mockResolvedValue(toolReply({ ok: "yes" })) })).rejects.toThrow(/expected shape/);
    await expect(completeJson(req, { config, fetchImpl: vi.fn().mockResolvedValue(reply({ stop_reason: "max_tokens" })) })).rejects.toThrow(/cut off/);
  });
});
