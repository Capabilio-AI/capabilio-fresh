import { describe, expect, it } from "vitest";
import { sqlTool, runExploratoryQuery, type SqlContent } from "@/lib/arena-workstations/tools/sql";
import type { Json } from "@/lib/supabase/types";
import { hashSeed } from "./rng";
import { worldForRole } from "./worlds";

const ctx = (userId: string, n: number, difficulty: "easy" | "medium" | "hard", avoidTitles: string[] = []) => ({
  roleName: "Data Analyst", parentSkill: "Data Analysis", areaName: "SQL", difficulty, avoidTitles,
  level: "senior" as const, roleKey: "data-analyst", worldSeed: hashSeed(userId, "data-analyst", "world"), ticketSeed: hashSeed(userId, "data-analyst", "ticket", n),
});

describe("SQL tool on a company world (no AI call)", () => {
  it("knows which roles have a world", () => {
    expect(worldForRole("data-analyst")?.name).toBe("BrightCart");
    expect(worldForRole("devops")).toBeNull();
  });

  it("serves a real ticket on the user's own warehouse, and grading tells right from wrong", async () => {
    const g = await sqlTool.generate(ctx("user-1", 0, "medium"));
    const content = g.content as unknown as SqlContent;
    expect(content.company).toBe("BrightCart");
    expect(content.tables.map((t) => t.name)).toEqual(["customers", "products", "orders", "order_items"]);
    expect(g.requester).toMatch(/·/);
    expect(g.origin?.provider).toBe("template");

    const key = g.answer_key as unknown as { reference_query: string };
    const right = await sqlTool.grade(g.content, g.answer_key, { query: key.reference_query });
    expect(right.passed).toBe(true);
    const wrong = await sqlTool.grade(g.content, g.answer_key, { query: "SELECT 1 AS x" });
    expect(wrong.passed).toBe(false);
  }, 20000);

  it("keeps one warehouse for a user across tickets, but a different one per user", async () => {
    const a1 = await sqlTool.generate(ctx("user-1", 1, "easy"));
    const a2 = await sqlTool.generate(ctx("user-1", 2, "hard"));
    const b1 = await sqlTool.generate(ctx("user-2", 1, "easy"));
    const tables = (g: { content: Json }) => JSON.stringify((g.content as unknown as SqlContent).tables);
    expect(tables(a1)).toBe(tables(a2));
    expect(tables(a1)).not.toBe(tables(b1));
  }, 30000);

  it("never repeats a title it was told to avoid", async () => {
    const first = await sqlTool.generate(ctx("user-3", 0, "easy"));
    const next = await sqlTool.generate(ctx("user-3", 1, "easy", [first.title]));
    expect(next.title).not.toBe(first.title);
  }, 30000);
});

describe("script tickets through the SQL tool", () => {
  it("grades a script on the state it leaves: reference passes, doing nothing and a script error fail", async () => {
    let found = 0;
    for (let n = 0; n < 14 && found < 3; n++) {
      const g = await sqlTool.generate({ ...ctx("user-script", n, "medium"), recentKinds: ["retrieval"] });
      const content = g.content as unknown as SqlContent;
      if (content.mode !== "script") continue;
      found++;
      const key = g.answer_key as unknown as { reference_script: string };
      expect((await sqlTool.grade(g.content, g.answer_key, { query: key.reference_script })).passed).toBe(true);
      const idle = await sqlTool.grade(g.content, g.answer_key, { query: "SELECT 1" });
      expect(idle.passed).toBe(false);
      const broken = await sqlTool.grade(g.content, g.answer_key, { query: "UPDATE nope SET x = 1" });
      expect(broken.passed).toBe(false);
      expect(broken.message).toMatch(/failed/i);
      expect(broken.checks[0]).toEqual({ label: "Script runs", passed: false });
    }
    expect(found).toBeGreaterThan(0);
  }, 120000);

  it("shows the effect of a script in exploration instead of running it as a query", async () => {
    for (let n = 0; n < 14; n++) {
      const g = await sqlTool.generate({ ...ctx("user-explore", n, "easy"), recentKinds: ["retrieval"] });
      if ((g.content as unknown as SqlContent).mode !== "script") continue;
      const key = g.answer_key as unknown as { reference_script: string };
      const shown = await runExploratoryQuery(g.content, key.reference_script);
      expect("rows" in shown && shown.rows.length).toBeGreaterThan(0);
      return;
    }
    throw new Error("no script ticket was served in 14 tries");
  }, 120000);
});
