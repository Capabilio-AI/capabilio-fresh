import { describe, expect, it } from "vitest";
import { standing } from "./SkillMatrix";
import type { MatrixRow } from "@/lib/capability/matrix";

const row = (name: string, over: Partial<MatrixRow> = {}): MatrixRow => ({ skillId: name, name, level: null, label: "Not assessed", verified: false, confidence: null, evidenceCount: 0, arenaPasses: 0, target: 70, gap: null, ...over });

describe("where you stand", () => {
  it("counts the skills with a first proof and the proofs in all", () => {
    const s = standing([row("A", { level: 3, verified: true, evidenceCount: 1 }), row("B", { level: 9, verified: true, evidenceCount: 3 }), row("C")]);
    expect(s).toMatchObject({ skills: 3, started: 2, proofs: 4 });
  });
  it("points at the practisable skill with the fewest proofs, the one asked for most first", () => {
    const practise = { areaKey: "k", areaName: "K" };
    const s = standing([row("A", { evidenceCount: 3, practise, target: 90 }), row("B", { evidenceCount: 1, practise, target: 60 }), row("C", { evidenceCount: 1, practise, target: 80 }), row("D", { evidenceCount: 0 })]);
    expect(s.next?.name).toBe("C");
  });
  it("has no next step when no skill can be practised, and says nothing is proven for an empty profile", () => {
    expect(standing([row("A")]).next).toBeNull();
    expect(standing([])).toMatchObject({ skills: 0, started: 0, proofs: 0, next: null });
  });
});
