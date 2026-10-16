import { describe, expect, it } from "vitest";
import type { z } from "zod";
import type { GenerationContext } from "@/lib/arena-workstations/types";
import { generateAiProblem, realDeps, type Deps } from "./ai";

const ctx: GenerationContext = { roleName: "Programming Languages", parentSkill: "Programming", areaName: "Language fundamentals", areaKey: "fundamentals", difficulty: "easy", avoidTitles: [], ticketSeed: 11, level: "fresher" };

const good = {
  title: "Count the late deliveries today",
  requester_name: "Asha Verma", requester_title: "Dispatch Lead",
  scenario: "Hi, I need to know how many of today's deliveries ran late. A delivery is late when it took more than its promised minutes.",
  deliverable: "Write late_count(taken, promised): both are lists of whole minutes of the same length. Return how many positions have taken[i] greater than promised[i].",
  function_name: "late_count", params: ["taken", "promised"], skill_tags: ["Lists", "Counting"],
  cases: [[[30, 20], [25, 25]], [[10], [10]], [[], []], [[5, 9, 12, 40], [6, 8, 12, 30]], [[1, 2, 3], [0, 0, 0]], [[7, 7], [8, 9]], [[50, 60, 70], [40, 80, 60]], [[3], [1]]],
  solution_js: "function late_count(taken, promised) { let n = 0; for (let i = 0; i < taken.length; i++) if (taken[i] > promised[i]) n++; return n; }",
  wrong_js: "function late_count(taken, promised) { let n = 0; for (let i = 0; i < taken.length; i++) if (taken[i] >= promised[i]) n++; return n; }",
};
const solver = { solution_js: "function late_count(a, b) { return a.filter((x, i) => x > b[i]).length; }" };

function fake(gen: unknown, second: unknown): Deps {
  let call = 0;
  return { llm: async <T,>(_p: string, _s: string, schema: z.ZodType<T>) => schema.parse(call++ === 0 ? gen : second), run: realDeps.run };
}
const reject = (gen: unknown, second: unknown = solver, c = ctx) => generateAiProblem(c, fake(gen, second));

describe("AI-generated programming exercise", () => {
  it("accepts an exercise whose solutions agree and whose wrong solution is wrong", async () => {
    const d = await reject(good);
    expect(d.content.fn).toBe("late_count");
    expect(d.content.examples).toHaveLength(2);
    expect(d.key.expected).toHaveLength(8);
    expect(d.content.starters.python).toContain("def late_count(taken, promised)");
  });
  it("rejects when two independent solutions disagree", async () => {
    await expect(reject(good, { solution_js: "function late_count(a, b) { return a.filter((x, i) => x >= b[i]).length; }" })).rejects.toThrow(/disagree/);
  });
  it("rejects a wrong solution that is not actually wrong", async () => {
    await expect(reject({ ...good, wrong_js: good.solution_js })).rejects.toThrow(/not wrong/);
  });
  it("rejects answers that barely vary, decimals, and repeated titles", async () => {
    await expect(reject({ ...good, solution_js: "function late_count() { return 0; }", wrong_js: "function late_count() { return 1; }" }, { solution_js: "function late_count() { return 0; }" })).rejects.toThrow(/barely vary/);
    await expect(reject({ ...good, solution_js: "function late_count(a) { return a.length / 3; }" }, { solution_js: "function late_count(a) { return a.length / 3; }" })).rejects.toThrow(/non-integer/);
    await expect(reject(good, solver, { ...ctx, avoidTitles: ["count the late deliveries today"] })).rejects.toThrow(/repeats/);
  });
  it("rejects code that never finishes, and cases with the wrong number of arguments", async () => {
    await expect(reject({ ...good, solution_js: "function late_count() { while (true) {} }" })).rejects.toThrow();
    await expect(reject({ ...good, cases: good.cases.map((c) => [c[0]]) })).rejects.toThrow(/one value per parameter/);
  }, 20_000);
  it("needs broken code in both languages for a debugging exercise, partly passing", async () => {
    const dctx = { ...ctx, areaKey: "debugging" };
    await expect(reject(good, solver, dctx)).rejects.toThrow(/broken code/);
    const broken = { broken_javascript: good.wrong_js, broken_python: "def late_count(taken, promised):\n    return sum(1 for i in range(len(taken)) if taken[i] >= promised[i])\n" };
    const d = await reject({ ...good, ...broken }, solver, dctx);
    expect(d.content.starters.python).toContain("def late_count(");
    await expect(reject({ ...good, broken_javascript: good.solution_js, broken_python: broken.broken_python }, solver, dctx)).rejects.toThrow(/pass some cases and fail others/);
  });

  it("accepts a backend exercise whose answers are objects, and tells the model it is an API exercise", async () => {
    const backend = {
      ...good,
      title: "Answer the stock check endpoint correctly",
      function_name: "stock_api", params: ["stock", "requests"],
      deliverable: "Write stock_api(stock, requests): stock maps an item to its count; each request is {item, qty}; answer {status: 200, body: {left}} and reduce the count when enough is left, otherwise {status: 409, body: {error: 'insufficient'}}, and {status: 404, body: {error: 'unknown'}} for an unknown item.",
      cases: [[{ pen: 2 }, [{ item: "pen", qty: 1 }]], [{ pen: 1 }, [{ item: "ink", qty: 1 }]], [{ pen: 3 }, [{ item: "pen", qty: 2 }, { item: "pen", qty: 2 }]], [{ a: 5 }, []], [{ a: 5 }, [{ item: "a", qty: 5 }, { item: "a", qty: 1 }]], [{ a: 1, b: 9 }, [{ item: "b", qty: 3 }, { item: "a", qty: 2 }]], [{ a: 4 }, [{ item: "zz", qty: 1 }, { item: "a", qty: 4 }]], [{ x: 2 }, [{ item: "x", qty: 2 }]]],
      solution_js: "function stock_api(stock, requests) { const s = { ...stock }; return requests.map((r) => { if (!(r.item in s)) return { status: 404, body: { error: 'unknown' } }; if (s[r.item] < r.qty) return { status: 409, body: { error: 'insufficient' } }; s[r.item] -= r.qty; return { status: 200, body: { left: s[r.item] } }; }); }",
      wrong_js: "function stock_api(stock, requests) { return requests.map((r) => (r.item in stock ? { status: 200, body: { left: stock[r.item] - r.qty } } : { status: 404, body: { error: 'unknown' } })); }",
    };
    const solver = { solution_js: "function stock_api(stock, requests) { const s = Object.assign({}, stock); const out = []; for (const r of requests) { if (s[r.item] === undefined) out.push({ status: 404, body: { error: 'unknown' } }); else if (s[r.item] < r.qty) out.push({ status: 409, body: { error: 'insufficient' } }); else { s[r.item] -= r.qty; out.push({ status: 200, body: { left: s[r.item] } }); } } return out; }" };
    const seen: string[] = [];
    const deps: Deps = { llm: async <T,>(p: string, _s: string, schema: z.ZodType<T>) => { seen.push(p); return schema.parse(seen.length === 1 ? backend : solver); }, run: realDeps.run };
    const d = await generateAiProblem({ ...ctx, roleKey: "backend-developer", areaKey: "rest-api", areaName: "REST APIs" }, deps);
    expect(d.content.fn).toBe("stock_api");
    expect(seen[0]).toContain("BACKEND exercise");
    expect(d.key.expected[0]).toEqual({ status: 200, body: { left: 1 } }.constructor === Object ? [{ status: 200, body: { left: 1 } }] : []);
  });
});
