import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { LlmError, generateStructured, mockAdapter, setAdapterForTest } from "./index";
import { openAiCompatible, type JsonMode } from "./adapters/openai-compatible";
import { routeFor } from "./config";

const Schema = z.object({ answer: z.string().min(1) });
const req = { task: "question" as const, system: "s", user: "u", schema: Schema, promptVersion: "test.v1" };
const fast = { sleep: async () => {}, random: () => 0 };

/** a fake OpenAI-style server: queue of {status, body} replies */
function fakeFetch(replies: { status: number; body?: unknown; headers?: Record<string, string> }[]) {
  const seen: { url: string; body: Record<string, unknown> }[] = [];
  const fn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    seen.push({ url: String(url), body: JSON.parse(String(init?.body)) });
    const r = replies.shift() ?? { status: 500 };
    return new Response(JSON.stringify(r.body ?? {}), { status: r.status, headers: r.headers });
  });
  return { fn: fn as unknown as typeof fetch, seen };
}
const ok = (answer: string) => ({ status: 200, body: { choices: [{ message: { content: JSON.stringify({ answer }) } }], usage: { prompt_tokens: 3, completion_tokens: 4 } } });

afterEach(() => {
  setAdapterForTest("groq", null);
  setAdapterForTest("openai-compatible", null);
  setAdapterForTest("mock", null);
});

// The SAME suite runs against every adapter flavour: only env (LLM_PROVIDER / LLM_MODEL) decides which one answers.
const flavours: { provider: string; mode: JsonMode }[] = [
  { provider: "groq", mode: "json_object" },
  { provider: "openai-compatible", mode: "json_schema" },
  { provider: "openai-compatible", mode: "prompt" },
];

describe.each(flavours)("adapter contract: $provider ($mode)", ({ provider, mode }) => {
  const env = { LLM_PROVIDER: provider, LLM_MODEL: "m-1" };
  const pin = (replies: Parameters<typeof fakeFetch>[0]) => {
    const f = fakeFetch(replies);
    setAdapterForTest(provider, openAiCompatible({ name: provider, baseUrl: "https://x.test/v1", apiKey: "k", jsonMode: mode, fetchImpl: f.fn }));
    return f;
  };

  it("returns validated JSON with provider, model, prompt version and usage", async () => {
    pin([ok("yes")]);
    const out = await generateStructured(req, { ...fast, env });
    expect(out).toMatchObject({ value: { answer: "yes" }, provider, model: "m-1", promptVersion: "test.v1", usage: { inputTokens: 3, outputTokens: 4 } });
  });

  it("sends the schema in the way the mode requires, and never the API key in the body", async () => {
    const f = pin([ok("yes")]);
    await generateStructured(req, { ...fast, env });
    const b = f.seen[0].body;
    expect(JSON.stringify(b)).not.toContain('"k"');
    if (mode === "json_schema") expect(b.response_format).toMatchObject({ type: "json_schema" });
    if (mode === "json_object") expect(b.response_format).toEqual({ type: "json_object" });
    if (mode === "prompt") expect(b.response_format).toBeUndefined();
    if (mode !== "json_schema") expect(JSON.stringify(b.messages)).toContain("JSON Schema");
  });

  it("feeds a validation failure back and accepts the corrected reply", async () => {
    const f = pin([ok(""), ok("fixed")]);
    const out = await generateStructured(req, { ...fast, env });
    expect(out.value.answer).toBe("fixed");
    expect(JSON.stringify(f.seen[1].body.messages)).toContain("previous reply was invalid");
  });

  it("raises invalid_output after the repair budget is spent", async () => {
    pin([ok(""), ok(""), ok("")]);
    await expect(generateStructured(req, { ...fast, env, repairs: 2 })).rejects.toMatchObject({ kind: "invalid_output" });
  });

  it("backs off on 429 (honouring Retry-After) and then succeeds", async () => {
    pin([{ status: 429, headers: { "retry-after": "2" } }, ok("later")]);
    const sleep = vi.fn(async (_ms: number) => {});
    const out = await generateStructured(req, { env, sleep, random: () => 0 });
    expect(out.value.answer).toBe("later");
    expect(sleep.mock.calls[0][0]).toBeGreaterThanOrEqual(2000);
  });

  it("classifies exhausted retries as rate_limit / provider_down", async () => {
    pin([{ status: 429 }, { status: 429 }]);
    await expect(generateStructured(req, { ...fast, env, attempts: 2 })).rejects.toMatchObject({ kind: "rate_limit" });
    pin([{ status: 503 }, { status: 503 }]);
    await expect(generateStructured(req, { ...fast, env, attempts: 2 })).rejects.toMatchObject({ kind: "provider_down" });
  });

  it("treats Groq's json_validate_failed 400 as a bad answer (repaired), not a bad request", async () => {
    pin([{ status: 400, body: { error: { code: "json_validate_failed", message: "Failed to validate JSON" } } }, ok("recovered")]);
    const out = await generateStructured(req, { ...fast, env });
    expect(out.value.answer).toBe("recovered");
  });

  it("does not retry a config error (bad key) and reports it as such", async () => {
    const f = pin([{ status: 401 }, ok("never")]);
    await expect(generateStructured(req, { ...fast, env })).rejects.toMatchObject({ kind: "config" });
    expect(f.fn).toHaveBeenCalledTimes(1);
  });
});

describe("routing and fallback by configuration only", () => {
  it("per-task overrides beat the global route; the legacy GROQ_MODEL name still works", () => {
    expect(routeFor("question", { QUESTION_MODEL: "q", LLM_MODEL: "g" }).primary).toEqual({ provider: "groq", model: "q" });
    expect(routeFor("feedback", { QUESTION_MODEL: "q", LLM_PROVIDER: "openai-compatible", LLM_MODEL: "g" }).primary).toEqual({ provider: "openai-compatible", model: "g" });
    expect(routeFor("question", { GROQ_MODEL: "legacy" }).primary.model).toBe("legacy");
    expect(routeFor("role_profile", { ROLE_PROFILE_PROVIDER: "bedrock", ROLE_PROFILE_MODEL: "claude" }).primary).toEqual({ provider: "bedrock", model: "claude" });
  });

  it("moves to the fallback provider/model once the primary is exhausted", async () => {
    const primary = mockAdapter(() => { throw new LlmError("provider_down", "down"); }, "mock");
    const second = mockAdapter(() => ({ answer: "from fallback" }), "openai-compatible");
    setAdapterForTest("mock", primary);
    setAdapterForTest("openai-compatible", second);
    const out = await generateStructured(req, { ...fast, attempts: 2, env: { LLM_PROVIDER: "mock", LLM_MODEL: "a", LLM_FALLBACK_PROVIDER: "openai-compatible", LLM_FALLBACK_MODEL: "b" } });
    expect(out).toMatchObject({ provider: "openai-compatible", model: "b", value: { answer: "from fallback" } });
    expect(primary.calls).toHaveLength(2);
  });

  it("swapping provider is an env change: the same code runs on the mock provider", async () => {
    setAdapterForTest("mock", mockAdapter(() => ({ answer: "mocked" })));
    expect((await generateStructured(req, { ...fast, env: { LLM_PROVIDER: "mock", LLM_MODEL: "x" } })).value.answer).toBe("mocked");
  });

  it("an unknown provider is a config error naming the registered ones", async () => {
    await expect(generateStructured(req, { ...fast, env: { LLM_PROVIDER: "nope", LLM_MODEL: "x" } })).rejects.toMatchObject({ kind: "config", message: expect.stringContaining("groq") });
  });
});

describe("long quota waits", () => {
  it("fails fast (no sleeping) when the provider says to come back in minutes, and fails over if a fallback exists", async () => {
    const sleep = vi.fn(async (_ms: number) => {});
    setAdapterForTest("groq", openAiCompatible({ name: "groq", baseUrl: "https://x.test/v1", apiKey: "k", jsonMode: "json_object", fetchImpl: fakeFetch([{ status: 429, headers: { "retry-after": "325" } }]).fn }));
    await expect(generateStructured(req, { sleep, random: () => 0, env: { LLM_PROVIDER: "groq", LLM_MODEL: "m" } })).rejects.toMatchObject({ kind: "rate_limit" });
    expect(sleep).not.toHaveBeenCalled();
    setAdapterForTest("mock", mockAdapter(() => ({ answer: "elsewhere" })));
    setAdapterForTest("groq", openAiCompatible({ name: "groq", baseUrl: "https://x.test/v1", apiKey: "k", jsonMode: "json_object", fetchImpl: fakeFetch([{ status: 429, headers: { "retry-after": "325" } }]).fn }));
    const out = await generateStructured(req, { sleep, random: () => 0, env: { LLM_PROVIDER: "groq", LLM_MODEL: "m", LLM_FALLBACK_PROVIDER: "mock", LLM_FALLBACK_MODEL: "f" } });
    expect(out).toMatchObject({ provider: "mock", model: "f" });
  });
});
