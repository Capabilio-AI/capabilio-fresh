import { describe, expect, it } from "vitest";
import { hashSeed, makeRng } from "../rng";
import type { MlDraft } from "../ml/tickets";
import { mlTool } from "@/lib/arena-workstations/tools/ml";
import { isTemplateOnlyArea } from "@/lib/arena-workstations/template-only";
import { ANALYST_PYTHON_TEMPLATES } from "./templates";

type NumbersKey = Extract<MlDraft["key"], { kind: "numbers" }>;
const SEEDS = 6;
const build = (id: string, i: number) => ANALYST_PYTHON_TEMPLATES.find((t) => t.id === id)!.build(makeRng(hashSeed("analyst-py", id, i)));
const grade = (d: MlDraft, answers: Record<string, string>) => mlTool.grade(d.content as never, d.key as never, { answers });
const exact = (key: NumbersKey) => Object.fromEntries(Object.entries(key.expected).map(([k, v]) => [k, String(v)]));

describe("Data Analyst Python tickets", () => {
  it("serve the python area from fixed templates, with fresher tickets in every difficulty they offer", () => {
    expect(isTemplateOnlyArea("python")).toBe(true);
    expect(ANALYST_PYTHON_TEMPLATES.every((t) => t.areas.includes("python"))).toBe(true);
    expect(ANALYST_PYTHON_TEMPLATES.filter((t) => t.minLevel === "fresher" && t.difficulty === "easy").length).toBeGreaterThanOrEqual(2);
    expect(ANALYST_PYTHON_TEMPLATES.filter((t) => t.minLevel === "fresher" && t.difficulty === "medium").length).toBeGreaterThanOrEqual(2);
  });

  for (const template of ANALYST_PYTHON_TEMPLATES) {
    it(`${template.id}: files are real CSVs, the key matches the fields, and only the right numbers pass`, async () => {
      for (let i = 0; i < SEEDS; i++) {
        const d = build(template.id, i);
        const key = d.key as NumbersKey;
        expect(d.content.kind).toBe("numbers");
        expect(d.content.files.length).toBeGreaterThan(0);
        for (const f of d.content.files) expect(f.text.split("\n").length).toBeGreaterThan(20);
        expect(Object.keys(key.expected).sort()).toEqual(d.content.fields.map((f) => f.key).sort());
        expect(Object.values(key.expected).every(Number.isFinite)).toBe(true);
        expect(d.content.starter).toContain("pd.read_csv");
        expect((await grade(d, exact(key))).passed).toBe(true);
        const wrong = { ...exact(key), [d.content.fields[0].key]: String(key.expected[d.content.fields[0].key] + 7) };
        expect((await grade(d, wrong)).passed).toBe(false);
      }
    });
  }

  it("py-count-orders: the key equals what pandas would print from the file the student gets", () => {
    const d = build("py-count-orders", 0);
    const [head, ...lines] = d.content.files[0].text.split("\n");
    const status = head.split(",").indexOf("status");
    const rows = lines.filter(Boolean).map((l) => l.split(","));
    const key = d.key as NumbersKey;
    expect(key.expected.total).toBe(rows.length);
    expect(key.expected.cancelled).toBe(rows.filter((r) => r[status] === "cancelled").length);
  });

  it("never sends the expected numbers to the student", () => {
    const d = build("py-delivered-revenue", 1);
    const shown = JSON.stringify(d.content);
    for (const v of Object.values((d.key as NumbersKey).expected)) expect(shown).not.toContain(`"${v}"`);
    expect(shown).not.toContain("expected");
  });
});
