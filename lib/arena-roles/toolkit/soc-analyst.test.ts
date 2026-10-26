import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateBlueprint } from "../blueprint";
import { SOC_ANALYST } from "../blueprints/soc-analyst";
import { SOC_TEMPLATES } from "@/lib/workplace/soc/templates";
import { socTool } from "@/lib/arena-workstations/tools/soc";
import { TOOLKIT as SOC_ANALYST_TOOLKIT } from "./soc-analyst";
import { validateToolkit } from "./types";

const migration = readFileSync(new URL("../../../supabase/migrations/134_soc_analyst_role.sql", import.meta.url), "utf8");

describe("SOC Analyst role", () => {
  it("has a well-formed blueprint and toolkit", () => {
    expect(validateBlueprint(SOC_ANALYST)).toEqual([]);
    expect(validateToolkit(SOC_ANALYST_TOOLKIT)).toEqual([]);
    expect(SOC_ANALYST_TOOLKIT.roleKey).toBe(SOC_ANALYST.domainRoleKey);
  });

  it("blueprint, migration, templates and tool agree on areas, tool and versions", () => {
    for (const a of SOC_ANALYST.areas) {
      expect(a.toolType).toBe(socTool.toolType);
      expect(a.generationVersion).toBe(socTool.generationVersion);
      expect(a.gradingVersion).toBe(socTool.gradingVersion);
      expect(migration).toContain(`('soc-analyst', '${a.areaKey}',`);
      expect(SOC_TEMPLATES.some((t) => t.areas.includes(a.areaKey))).toBe(true);
    }
    expect(SOC_TEMPLATES.flatMap((t) => t.areas).every((k) => SOC_ANALYST.areas.some((a) => a.areaKey === k))).toBe(true);
  });
});
