import { referenceNote, type NoteKey } from "./findings-note";
import { describe, expect, it } from "vitest";
import { sqlTool, runExploratoryQuery, type SqlContent } from "@/lib/arena-workstations/tools/sql";
import { hashSeed } from "./rng";

process.env.PG_TIMEOUT_MS ||= "90000";

const ctx = (roleKey: string, areaKey: string, userId: string, n: number, difficulty: "easy" | "medium" | "hard") => ({
  roleName: "SQL Developer", parentSkill: "SQL", areaName: areaKey, difficulty, avoidTitles: [], level: "senior" as const, recentKinds: [],
  roleKey, areaKey, worldSeed: hashSeed(userId, roleKey, "world"), ticketSeed: hashSeed(userId, roleKey, "ticket", n),
});

import { dashboardTool } from "@/lib/arena-workstations/tools/dashboard";
import type { BiSpec } from "@/lib/arena-workstations/engines/bi";

describe("dashboards for the BI Developer", () => {
  it("serves a dashboard ticket on the company data to the BI Developer role", async () => {
    const g = await dashboardTool.generate(ctx("bi-developer", "dashboard", "bi-user", 0, "medium"));
    expect(g.origin?.provider).toBe("template");
    const { spec, note } = g.answer_key as unknown as { spec: BiSpec; note?: NoteKey };
    // at senior level the takeaway is part of the work
    expect((await dashboardTool.grade(g.content, g.answer_key, { spec, note: note ? referenceNote(note) : undefined })).passed).toBe(true);
  });
});

describe("SQL tool on PostgreSQL", () => {
  for (const [role, area, difficulty] of [["sql-developer", "programmability", "medium"], ["database-admin", "security", "hard"], ["data-engineer-sql", "transformation", "medium"], ["bi-developer", "queries", "medium"], ["sql-developer", "debugging", "easy"], ["sql-developer", "data-changes", "medium"], ["database-admin", "performance", "medium"], ["database-admin", "maintenance", "medium"], ["data-engineer-sql", "data-changes", "easy"]] as const) {
    it(`${role} / ${area}: serves a Postgres ticket that grades right and wrong answers correctly`, async () => {
      const g = await sqlTool.generate(ctx(role, area, "pg-user", 0, difficulty));
      const content = g.content as unknown as SqlContent;
      expect(content.engine).toBe("postgres");
      expect(g.origin?.provider).toBe("template");
      const key = g.answer_key as unknown as { reference_script?: string; reference_query?: string };
      const reference = key.reference_script ?? key.reference_query!;
      expect((await sqlTool.grade(g.content, g.answer_key, { query: reference })).passed).toBe(true);
      expect((await sqlTool.grade(g.content, g.answer_key, { query: "SELECT 1 AS nothing" })).passed).toBe(false);
      if (content.mode === "script") {
        const shown = await runExploratoryQuery(g.content, reference);
        expect("rows" in shown).toBe(true);
      }
    }, 240_000);
  }
});
