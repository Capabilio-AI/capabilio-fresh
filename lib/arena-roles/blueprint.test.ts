import { describe, expect, it } from "vitest";
import { isRegisteredTool, toolFor } from "@/lib/arena-workstations/registry";
import { catalogRole } from "./catalog";
import { validateBlueprint, type RoleBlueprint } from "./blueprint";
import { DATA_ANALYST } from "./blueprints/data-analyst";

describe("validateBlueprint", () => {
  const base: RoleBlueprint = {
    roleId: "X-01", domainRoleKey: "x", name: "X", limitations: [],
    competencies: [{ id: "c1", label: "C1" }],
    areas: [{ areaKey: "a", toolType: "t", generationVersion: "g", gradingVersion: "r", executionMode: "executed", status: "enabled", competencies: ["c1"] }],
  };

  it("accepts a well-formed blueprint", () => {
    expect(validateBlueprint(base)).toEqual([]);
  });

  it("flags an unassessed competency, an unknown mapping and a blocked area without a reason", () => {
    expect(validateBlueprint({ ...base, competencies: [...base.competencies, { id: "c2", label: "C2" }] })).toContain("competency c2 is not assessed by any area");
    expect(validateBlueprint({ ...base, areas: [{ ...base.areas[0], competencies: ["c1", "nope"] }] })).toContain("area a maps to unknown competency nope");
    expect(validateBlueprint({ ...base, areas: [{ ...base.areas[0], status: "blocked", executionMode: "none", competencies: [] }, ...base.areas] })).toContain('blocked area a needs a reason and execution mode "none"');
  });
});

describe("IT-01 Data Analyst blueprint", () => {
  it("is well-formed", () => {
    expect(validateBlueprint(DATA_ANALYST)).toEqual([]);
  });

  it("matches the catalog entry", () => {
    const entry = catalogRole(DATA_ANALYST.roleId);
    expect(entry?.name).toBe(DATA_ANALYST.name);
    expect(entry?.domainRoleKey).toBe(DATA_ANALYST.domainRoleKey);
  });

  it("declares exactly the tool versions the server registry provides", () => {
    for (const a of DATA_ANALYST.areas.filter((x) => x.status === "enabled")) {
      expect(isRegisteredTool(a.toolType), a.areaKey).toBe(true);
      const tool = toolFor(a.toolType);
      expect([tool.generationVersion, tool.gradingVersion], a.areaKey).toEqual([a.generationVersion, a.gradingVersion]);
    }
  });

  it("keeps Python blocked and unregistered", () => {
    const python = DATA_ANALYST.areas.find((a) => a.areaKey === "python")!;
    expect(python.status).toBe("blocked");
    expect(isRegisteredTool(python.toolType)).toBe(false);
  });
});
