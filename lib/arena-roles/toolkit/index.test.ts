import { describe, expect, it } from "vitest";
import { toolkitFor } from "./index";
import { validateToolkit } from "./types";
import { TIER_LABEL } from "@/components/arena/RoleToolkitPanel";

const WAVE_1 = ["data-scientist", "ai-ml-engineer", "data-engineer-sql", "application-developer", "business-analyst", "soc-analyst"];

describe("toolkitFor", () => {
  it.each(WAVE_1)("%s has a usable descriptor keyed to its own role", (key) => {
    const t = toolkitFor(key);
    expect(t).not.toBeNull();
    expect(t!.roleKey).toBe(key);
    expect(validateToolkit(t!)).toEqual([]);
  });

  it("returns null for a role without a descriptor, never another role's toolkit", () => {
    expect(toolkitFor("data-analyst")).toBeNull();
    expect(toolkitFor("")).toBeNull();
    expect(toolkitFor("constructor")).toBeNull();
  });

  it("every workstation tier has a label the panel can render", () => {
    for (const key of WAVE_1) for (const w of toolkitFor(key)!.workstations) expect(TIER_LABEL[w.tier]?.name).toBeTruthy();
  });

  it("list entries the panel keys on are unique", () => {
    for (const key of WAVE_1) {
      const t = toolkitFor(key)!;
      const unique = (xs: string[]) => new Set(xs).size === xs.length;
      expect(unique(t.workstations.map((w) => `${w.toolType}-${w.name}`))).toBe(true);
      expect(unique(t.environment.map((e) => e.label))).toBe(true);
      expect(unique(t.firstWeek)).toBe(true);
      expect(unique(t.portfolioArtifacts)).toBe(true);
      expect(unique(t.honestLimits)).toBe(true);
    }
  });
});
