import { describe, expect, it } from "vitest";
import { investigationTool, type InvestigationContent } from "@/lib/arena-workstations/tools/investigation";
import { runExploratoryQuery, sqlTool, type SqlContent } from "@/lib/arena-workstations/tools/sql";
import { hashSeed } from "./rng";

const ctx = (areaKey: string, userId: string, n: number, difficulty: "easy" | "medium" | "hard") => ({
  roleName: "Data Analyst", parentSkill: "Data Analysis", areaName: areaKey, difficulty, avoidTitles: [], level: "senior" as const, recentKinds: [],
  roleKey: "data-analyst", areaKey, worldSeed: hashSeed(userId, "data-analyst", "world"), ticketSeed: hashSeed(userId, "data-analyst", "ticket", n),
});
const answersOf = (g: { answer_key: unknown }) => (g.answer_key as { answers: Record<string, string | number> }).answers;

describe("investigation tool (detective and incident)", () => {
  for (const [area, difficulty] of [["investigation", "medium"], ["incident", "hard"]] as const) {
    it(`${area}: serves a ticket from the user's data, never shows the answers, and grades findings`, async () => {
      const g = await investigationTool.generate(ctx(area, "u-inv", 0, difficulty));
      expect(g.origin?.provider).toBe("template");
      const content = g.content as unknown as InvestigationContent;
      expect(content.company).toBe("BrightCart");
      expect(content.tables.map((t) => t.name)).toEqual(["customers", "products", "orders", "order_items"]);
      expect(JSON.stringify(g.content)).not.toContain("answers");
      expect(g.requester).toMatch(/·/);

      const right = answersOf(g);
      expect((await investigationTool.grade(g.content, g.answer_key, { answers: right })).passed).toBe(true);

      // a wrong finding fails, and the message does not give the right one away
      const firstText = content.fields.find((f) => f.type !== "number")!;
      const wrong = await investigationTool.grade(g.content, g.answer_key, { answers: { ...right, [firstText.key]: "Nowhere" } });
      expect(wrong.passed).toBe(false);
      expect(JSON.stringify(wrong)).not.toContain(String(right[firstText.key]));
      expect((await investigationTool.grade(g.content, g.answer_key, { answers: {} })).passed).toBe(false);
    }, 60_000);
  }

  it("is forgiving about how a number or a text is typed, but not about what it says", async () => {
    const g = await investigationTool.generate(ctx("investigation", "u-inv-2", 1, "medium"));
    const right = answersOf(g);
    const key = g.answer_key as unknown as { tolerance: Record<string, number> };
    const pretty = `₹ ${Number(right.impact).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
    const text = String(right.value ?? right.channel ?? right.where);
    const textKey = "value" in right ? "value" : "channel" in right ? "channel" : "where";
    expect((await investigationTool.grade(g.content, g.answer_key, { answers: { ...right, impact: pretty, [textKey]: `  ${text.toUpperCase()}  ` } })).passed).toBe(true);
    expect((await investigationTool.grade(g.content, g.answer_key, { answers: { ...right, impact: Number(right.impact) + key.tolerance.impact + 5 } })).passed).toBe(false);
  }, 60_000);

  it("lets the user explore the data with SQL while investigating", async () => {
    const g = await investigationTool.generate(ctx("incident", "u-inv-3", 0, "hard"));
    const r = await runExploratoryQuery(g.content, "SELECT COUNT(*) AS n FROM orders");
    expect("rows" in r && Number(r.rows[0][0])).toBeGreaterThan(150);
  }, 60_000);
});

describe("SQL debugging tickets", () => {
  it("opens the editor with the broken query; the fixed one passes and the broken one fails", async () => {
    for (let n = 0; n < 4; n++) {
      const g = await sqlTool.generate(ctx("debugging", "u-debug", n, n % 2 ? "medium" : "easy"));
      const content = g.content as unknown as SqlContent;
      expect(content.starter).toBeTruthy();
      expect(g.title.startsWith("Fix:")).toBe(true);
      const key = g.answer_key as unknown as { reference_query: string };
      expect((await sqlTool.grade(g.content, g.answer_key, { query: key.reference_query })).passed).toBe(true);
      expect((await sqlTool.grade(g.content, g.answer_key, { query: content.starter! })).passed).toBe(false);
    }
  }, 60_000);
});
