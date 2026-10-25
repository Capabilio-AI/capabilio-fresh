import { describe, expect, it } from "vitest";
import { generateWithRetry, type Difficulty, type StreamAsk } from "./generate";
import { kindFor } from "./plan";

// Real model, real sandbox, no database. Reports how often a fresh challenge survives its own checks across very different branches.
const BRANCHES: { branch: string; subject: string | null }[] = [
  { branch: "Mechanical Engineering", subject: "Thermodynamics" },
  { branch: "Civil Engineering", subject: "Strength of Materials" },
  { branch: "Electrical and Electronics Engineering", subject: "Circuit Theory" },
  { branch: "Electronics and Communication Engineering", subject: null },
  { branch: "Chemical Engineering", subject: "Fluid Mechanics" },
  { branch: "Master of Business Administration", subject: "Financial Management" },
  { branch: "Biotechnology", subject: null },
  { branch: "Automobile Engineering", subject: "Vehicle Dynamics" },
];
const LEVELS: Difficulty[] = ["easy", "medium", "hard"];

describe("non-IT Stream challenges, live", () => {
  it("most fresh challenges prove themselves, across branches, and they differ", async () => {
    const titles: string[] = [];
    const reasons: string[] = [];
    let accepted = 0;
    let numeric = 0;
    const results = await Promise.all(
      BRANCHES.map(async (b, i) => {
        const ask: StreamAsk = { kind: kindFor(i), difficulty: LEVELS[i % 3], branch: b.branch, subject: b.subject, year: 2 + (i % 3), avoidTitles: [], seed: 100 + i };
        return { b, ask, r: await generateWithRetry(ask) };
      })
    );
    for (const { b, r } of results) {
      if (r.draft) {
        accepted++;
        if (r.draft.kind === "numeric") numeric++;
        titles.push(r.draft.title);
        console.log(`ACCEPTED [${b.branch}] ${r.draft.kind} ${r.draft.difficulty}: ${r.draft.title} -> ${r.draft.kind === "numeric" ? `${r.draft.expected} ${r.draft.answerUnit}` : r.draft.expected}${r.reasons.length ? ` (after ${r.reasons.length} rejection)` : ""}`);
      } else reasons.push(`[${b.branch}] ${r.reasons.join(" | ")}`);
    }
    console.log(`accepted ${accepted}/${BRANCHES.length} (${numeric} calculations)\nrejections:\n${reasons.join("\n")}`);
    expect(new Set(titles).size).toBe(titles.length);
    expect(accepted).toBeGreaterThanOrEqual(Math.ceil(BRANCHES.length * 0.6));
  }, 600_000);
});
