import { describe, expect, it } from "vitest";
import { validateBlueprint } from "./blueprint";
import { validateToolkit } from "./toolkit/types";
import { SITE_ENGINEER } from "./blueprints/site-engineer";
import { TOOLKIT } from "./toolkit/site-engineer";
import { SITE_CALC_TEMPLATES } from "@/lib/workplace/calc/site";

describe("site engineer role", () => {
  it("has a well-formed blueprint and toolkit", () => {
    expect(validateBlueprint(SITE_ENGINEER)).toEqual([]);
    expect(validateToolkit(TOOLKIT)).toEqual([]);
    expect(TOOLKIT.roleId).toBe(SITE_ENGINEER.roleId);
    expect(TOOLKIT.roleKey).toBe(SITE_ENGINEER.domainRoleKey);
  });

  it("serves exactly the areas that have templates, all site- prefixed", () => {
    const areas = SITE_ENGINEER.areas.map((a) => a.areaKey).sort();
    expect(areas.every((a) => a.startsWith("site-"))).toBe(true);
    expect(areas).toEqual([...new Set(SITE_CALC_TEMPLATES.flatMap((t) => t.areas))].sort());
  });
});
