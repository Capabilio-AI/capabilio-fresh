import { describe, expect, it } from "vitest";
import type { z } from "zod";
import type { GenerationContext } from "@/lib/arena-workstations/types";
import { generateAiMl, type Deps } from "./ai";

const ctx = (areaKey: string, difficulty: GenerationContext["difficulty"] = "medium"): GenerationContext => ({ roleName: "AI / ML Engineer", parentSkill: "Machine Learning", areaName: areaKey, areaKey, difficulty, avoidTitles: [], ticketSeed: 21, level: "junior" });

const spec = (over: Record<string, unknown> = {}) => ({
  entity: "patient", id_column: "patient_id",
  target: { name: "readmitted", positive_meaning: "the patient came back within 30 days", prevalence: 0.15 },
  features: [
    { name: "age_years", kind: "int", min: 18, max: 90, effect: 1.6 },
    { name: "prior_admissions", kind: "int", min: 0, max: 6, effect: 2.4, step_at: 3, step_effect: 0.8 },
    { name: "stay_days", kind: "float", min: 1, max: 20, skew: "right", effect: 1.2, missing: 0.05 },
    { name: "ward", kind: "category", categories: [{ value: "general", weight: 60, effect: 0 }, { value: "cardiac", weight: 25, effect: 0.9 }, { value: "surgical", weight: 15, effect: -0.5 }] },
  ],
  leak: { name: "followup_booked", description: "a follow-up visit booked after the patient had already returned" },
  ...over,
});
const gen = (s: unknown, extra: Record<string, unknown> = {}) => ({ company: "Sahyadri Care", requester_name: "Dr Meena Rao", requester_title: "Quality Lead", title: "Which patients come back within a month?", scenario: "Hi, readmissions are costing us beds and goodwill. I want a model that flags the patients most likely to return so the ward can plan follow-up calls.", spec: s, ...extra });
const fake = (out: unknown): Deps => ({ llm: async <T,>(_p: string, _s: string, schema: z.ZodType<T>) => schema.parse(out) });

describe("AI-described ML scenarios", () => {
  it("builds a prediction ticket the learner can solve, from a scenario nobody wrote in advance", async () => {
    const d = await generateAiMl(ctx("model-training"), fake(gen(spec())));
    expect(d.content.kind).toBe("predict");
    expect(d.content.files[0].text.split("\n")[0]).toBe("patient_id,age_years,prior_admissions,stay_days,ward,readmitted");
    expect(d.content.deliverable).toContain("the patient came back within 30 days");
    expect(d.key.kind === "predict" && d.key.threshold).toBeGreaterThan(0);
  }, 30_000);

  it("builds a leakage ticket whose train file holds the leaked column and whose test file leaves it empty", async () => {
    const d = await generateAiMl(ctx("pipeline-debugging"), fake(gen(spec())));
    const [train, test] = d.content.files;
    expect(train.text.split("\n")[0]).toContain("followup_booked");
    expect(test.text.split("\n")[1].split(",").at(-1)).toBe("");
    expect(d.content.starter).toContain("followup_booked");
  }, 30_000);

  it("builds cleaning, evaluation and maths tickets from the scenario", async () => {
    const prep = await generateAiMl(ctx("data-preparation"), fake(gen(spec())));
    expect(prep.content.fields.map((f) => f.key)).toEqual(["rows", "categories", "median", "mean"]);
    expect(prep.content.starter).toContain("age_years");
    const evalT = await generateAiMl(ctx("evaluation"), fake(gen(spec())));
    expect(evalT.scenario).toContain("accurate");
    const maths = await generateAiMl(ctx("ml-fundamentals"), fake(gen(spec(), { math_op: "softmax" })));
    expect(maths.content.fields).toHaveLength(4);
    await expect(generateAiMl(ctx("ml-fundamentals"), fake(gen(spec())))).rejects.toThrow(/math_op/);
  }, 30_000);

  it("rejects a scenario whose features carry no signal", async () => {
    const noSignal = spec({ features: spec().features.map((f) => ({ ...f, effect: 0, step_effect: 0, categories: "categories" in f ? (f.categories as { value: string; weight: number }[]).map((c) => ({ ...c, effect: 0 })) : undefined })) });
    await expect(generateAiMl(ctx("model-training"), fake(gen(noSignal)))).rejects.toThrow(/barely predict|cannot reach/);
  }, 30_000);

  it("rejects malformed specs and repeated titles", async () => {
    await expect(generateAiMl(ctx("model-training"), fake(gen(spec({ features: [] }))))).rejects.toThrow();
    await expect(generateAiMl({ ...ctx("model-training"), avoidTitles: ["which patients come back within a month?"] }, fake(gen(spec())))).rejects.toThrow(/repeats/);
  });

  it("different scenarios give different datasets", async () => {
    const a = await generateAiMl(ctx("model-training"), fake(gen(spec())));
    const b = await generateAiMl(ctx("model-training"), fake(gen(spec({ features: spec().features.map((f) => (f.name === "age_years" ? { ...f, name: "patient_age" } : f)) }))));
    expect(a.content.files[0].text.split("\n")[0]).not.toBe(b.content.files[0].text.split("\n")[0]);
  }, 30_000);
});
