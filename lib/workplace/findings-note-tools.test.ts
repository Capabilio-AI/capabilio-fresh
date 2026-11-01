import { describe, expect, it } from "vitest";
import { dashboardTool } from "@/lib/arena-workstations/tools/dashboard";
import { investigationTool } from "@/lib/arena-workstations/tools/investigation";
import { evaluateSpec } from "@/lib/arena-workstations/engines/bi";
import type { GenerationContext } from "@/lib/arena-workstations/types";
import type { BiSpec } from "@/lib/arena-workstations/engines/bi";
import { hashSeed } from "./rng";

const ctx = (areaKey: string, level: "fresher" | "junior", difficulty: "easy" | "medium" | "hard", i = 0): GenerationContext =>
  ({ roleKey: "data-analyst", roleName: "Data Analyst", areaKey, areaName: areaKey, difficulty, level, avoidTitles: [], worldSeed: hashSeed("note-test", i), ticketSeed: hashSeed("note-ticket", i) }) as unknown as GenerationContext;

describe("graded notes at junior level and above", () => {
  it("investigation: a fresher is not asked for a note, a graduate-level ticket requires a correct one", async () => {
    const fresher = await investigationTool.generate(ctx("investigation", "fresher", "easy"));
    expect((fresher.content as { noteRequired?: boolean }).noteRequired).toBe(false);

    const g = await investigationTool.generate(ctx("incident", "junior", "medium", 3));
    expect((g.content as { noteRequired?: boolean }).noteRequired).toBe(true);
    const key = g.answer_key as unknown as { answers: Record<string, string | number>; note: { figures: { value: number }[]; names: string[] } };
    const answers = Object.fromEntries(Object.entries(key.answers).map(([k, v]) => [k, String(v)]));
    const figure = key.note.figures[0].value.toLocaleString("en-IN");
    const note = `The problem is at ${key.note.names.join(" and ")} and it overstates revenue by ₹${figure}. I recommend we fix the load and re-run the dashboard after checking the source for the same problem.`;
    expect((await investigationTool.grade(g.content, g.answer_key, { answers })).passed).toBe(false); // right findings, no note
    expect((await investigationTool.grade(g.content, g.answer_key, { answers, note })).passed).toBe(true);
    const bad = await investigationTool.grade(g.content, g.answer_key, { answers, note: note.replace(`₹${figure}`, "₹1") });
    expect(bad.passed).toBe(false);
    expect(bad.checks.find((c) => c.label.startsWith("Note: states"))!.passed).toBe(false);
    // a wrong finding still fails even with a perfect note
    expect((await investigationTool.grade(g.content, g.answer_key, { answers: { ...answers, [Object.keys(answers)[0]]: "nonsense" }, note })).passed).toBe(false);
  });

  it("dashboard: the takeaway must name the standout and give its value", async () => {
    const g = await dashboardTool.generate(ctx("dashboard", "junior", "medium", 5));
    const content = g.content as unknown as { noteRequired?: boolean; dataset: Parameters<typeof evaluateSpec>[0]; requirements: string[] };
    expect(content.noteRequired).toBe(true);
    expect(content.requirements.join(" ")).toMatch(/takeaway/i);
    const spec = (g.answer_key as unknown as { spec: BiSpec }).spec;
    const top = [...evaluateSpec(content.dataset, spec)].sort((a, b) => b.value - a.value)[0];
    const note = `${top.label} stands out at ${top.value}, well ahead of the rest. I recommend we review what is working there and look at doing the same elsewhere next month.`;
    const withoutNote = await dashboardTool.grade(g.content, g.answer_key, { spec });
    expect(withoutNote.passed).toBe(false);
    expect((await dashboardTool.grade(g.content, g.answer_key, { spec, note })).passed).toBe(true);
    expect((await dashboardTool.grade(g.content, g.answer_key, { spec, note: note.replace(top.label, "Nowhere") })).passed).toBe(false);

    const fresher = await dashboardTool.generate(ctx("dashboard", "fresher", "easy", 5));
    expect((await dashboardTool.grade(fresher.content, fresher.answer_key, { spec: (fresher.answer_key as unknown as { spec: BiSpec }).spec })).passed).toBe(true);
  });
});
