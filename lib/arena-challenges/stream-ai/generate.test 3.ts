import { describe, expect, it } from "vitest";
import type { z } from "zod";
import { generateStreamDraft, generateWithRetry, realDeps, type Deps, type StreamAsk } from "./generate";

const ask: StreamAsk = { kind: "numeric", difficulty: "medium", branch: "Mechanical Engineering", subject: "Strength of Materials", year: 2, avoidTitles: [], seed: 5 };

const numeric = {
  title: "Stress in a steel hanger rod",
  category: "Strength of Materials",
  scenario: "A steel rod of diameter 20 mm hangs a tank and carries an axial tensile load of 31.4 kN. Treat the load as acting evenly over the rod's circular cross-section.",
  objective: "Find the normal stress in the rod in MPa.",
  answer_unit: "MPa",
  skill_tags: ["Stress"],
  solution_js: "function answer() { const d = 0.02; const a = Math.PI * d * d / 4; return 31400 / a / 1e6; }",
};
const solverSame = { underspecified: false, solution_js: "function answer() { return 31400 / (Math.PI * 10 * 10) ; }" }; // N / mm^2 = MPa
const solverWrong = { underspecified: false, solution_js: "function answer() { return 31400 / (Math.PI * 20 * 20); }" };

const mcq = {
  title: "Choosing the right heat treatment",
  category: "Materials",
  scenario: "A gear must have a hard wear-resistant surface but a tough core that can absorb shock loads without cracking. The gear is made of low-carbon steel.",
  objective: "Which process best gives this combination?",
  options: ["Case hardening (carburising)", "Full annealing", "Normalising only", "Through hardening followed by no tempering"],
  correct: 0,
  explanation: "Case hardening enriches only the surface with carbon, so the surface hardens while the low-carbon core stays tough.",
  skill_tags: ["Heat treatment"],
};

/** returns the scripted answers in order: first the generated problem, then the independent solver */
function scripted(...replies: unknown[]): Deps {
  let i = 0;
  return { llm: async <T,>(_p: string, _s: string, schema: z.ZodType<T>) => schema.parse(replies[i++]), run: realDeps.run };
}

describe("numeric Stream challenge", () => {
  it("is accepted when an independent solver reaches the same number", async () => {
    const d = await generateStreamDraft(ask, scripted(numeric, solverSame));
    expect(d.kind).toBe("numeric");
    expect(Number(d.expected)).toBeCloseTo(100, 0);
    expect(d.answerUnit).toBe("MPa");
  });
  it("is rejected when the two solutions disagree", async () => {
    await expect(generateStreamDraft(ask, scripted(numeric, solverWrong))).rejects.toThrow(/disagree/);
  });
  it("is rejected when the solver says a value is missing", async () => {
    await expect(generateStreamDraft(ask, scripted(numeric, { underspecified: true }))).rejects.toThrow(/missing a value/);
  });
  it("is rejected when the answer is already in the scenario", async () => {
    const d = await generateStreamDraft(ask, scripted(numeric, solverSame));
    await expect(generateStreamDraft(ask, scripted({ ...numeric, scenario: `${numeric.scenario} Answer ${d.expected}` }, solverSame))).rejects.toThrow(/already appears/);
  });
  it("is rejected when its solution does not run or returns a non-number", async () => {
    await expect(generateStreamDraft(ask, scripted({ ...numeric, solution_js: "function answer() { return 'x' + 'y' + 'z' + '!!!!!!!!!!'; }" }, solverSame))).rejects.toThrow(/number/);
    await expect(generateStreamDraft(ask, scripted({ ...numeric, solution_js: "function answer() { throw new Error('boom boom boom boom'); }" }, solverSame))).rejects.toThrow(/number|run/);
  });
  it("is rejected when the title repeats", async () => {
    await expect(generateStreamDraft({ ...ask, avoidTitles: ["Stress in a steel hanger rod"] }, scripted(numeric, solverSame))).rejects.toThrow(/repeats/);
  });
});

describe("concept Stream challenge", () => {
  const mcqAsk: StreamAsk = { ...ask, kind: "mcq" };
  it("is accepted when an independent solver picks the same option, wherever the shuffle put it", async () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 12; seed++) {
      let chosen = "";
      const deps: Deps = {
        llm: async <T,>(prompt: string, _s: string, schema: z.ZodType<T>) => {
          if (!chosen) { chosen = "gen"; return schema.parse(mcq); }
          const line = prompt.split("\n").find((l) => l.includes("Case hardening"))!;
          return schema.parse({ choice: line[0] });
        },
        run: realDeps.run,
      };
      const d = await generateStreamDraft({ ...mcqAsk, seed }, deps);
      expect(d.options).toHaveLength(4);
      expect(d.options!.find((o) => o.key === d.expected)!.text).toBe("Case hardening (carburising)");
      seen.add(d.expected);
    }
    expect(seen.size).toBeGreaterThan(1); // the right answer is not always the same letter
  });
  it("is rejected when the solver disagrees, options repeat, or 'none of the above' appears", async () => {
    await expect(generateStreamDraft(mcqAsk, scripted(mcq, { choice: "NONE" }))).rejects.toThrow(/ambiguous or wrong/);
    await expect(generateStreamDraft(mcqAsk, scripted({ ...mcq, options: ["Same thing", "same thing!", "Other", "Another"] }, { choice: "A" }))).rejects.toThrow(/same thing/);
    await expect(generateStreamDraft(mcqAsk, scripted({ ...mcq, options: ["Case hardening", "Annealing", "Normalising", "None of the above"] }, { choice: "A" }))).rejects.toThrow(/of the above/);
  });
});

describe("generateWithRetry", () => {
  it("retries with the reason, then tries the other kind, then gives up with the reasons", async () => {
    const r = await generateWithRetry(ask, scripted(numeric, solverWrong, numeric, solverWrong, mcq, { choice: "NONE" }));
    expect(r.draft).toBeNull();
    expect(r.reasons).toHaveLength(3);
  });
  it("returns the first challenge that proves itself", async () => {
    const r = await generateWithRetry(ask, scripted(numeric, solverWrong, numeric, solverSame));
    expect(r.draft?.kind).toBe("numeric");
    expect(r.reasons).toHaveLength(1);
  });
  it("falls back to a concept question when a calculation does not fit", async () => {
    let call = 0;
    const deps: Deps = {
      llm: async <T,>(prompt: string, _s: string, schema: z.ZodType<T>) => {
        call++;
        if (call <= 4) return schema.parse(call % 2 ? numeric : { underspecified: true }); // two calculation tries, each with a solver that finds a gap
        if (call === 5) return schema.parse(mcq);
        return schema.parse({ choice: prompt.split("\n").find((l) => l.includes("Case hardening"))![0] });
      },
      run: realDeps.run,
    };
    const r = await generateWithRetry(ask, deps);
    expect(r.draft?.kind).toBe("mcq");
    expect(r.reasons).toHaveLength(2);
  });
});
