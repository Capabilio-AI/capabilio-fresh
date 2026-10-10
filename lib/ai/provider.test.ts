import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { mockAdapter, setAdapterForTest } from "./llm";
import { completeStructured } from "./provider";

afterEach(() => setAdapterForTest("mock", null));

describe("completeStructured", () => {
  it("goes through the shared layer and reports provider:model", async () => {
    process.env.LLM_PROVIDER = "mock";
    process.env.LLM_MODEL = "m1";
    setAdapterForTest("mock", mockAdapter(() => ({ ok: true })));
    const out = await completeStructured({ system: "s", user: "u", toolName: "t", toolDescription: "d", inputSchema: {}, schema: z.object({ ok: z.boolean() }) });
    expect(out.value.ok).toBe(true);
    expect(out.model).toBe("mock:m1");
    delete process.env.LLM_PROVIDER;
    delete process.env.LLM_MODEL;
  });
});
