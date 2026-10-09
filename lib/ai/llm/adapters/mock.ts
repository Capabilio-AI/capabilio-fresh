import type { LlmAdapter, RawRequest, RawResult } from "../types";

export interface MockCall {
  req: RawRequest;
}

/**
 * Test provider: replies come from a function, so tests (and contract tests) never touch a network. Selected with
 * LLM_PROVIDER=mock, or registered directly under any name in a test.
 */
export function mockAdapter(reply: (req: RawRequest, n: number) => unknown | Promise<unknown>, name = "mock"): LlmAdapter & { calls: MockCall[] } {
  const calls: MockCall[] = [];
  return {
    name,
    calls,
    async complete(req: RawRequest): Promise<RawResult> {
      calls.push({ req });
      const out = await reply(req, calls.length);
      return { text: typeof out === "string" ? out : JSON.stringify(out), usage: { inputTokens: null, outputTokens: null } };
    },
  };
}
