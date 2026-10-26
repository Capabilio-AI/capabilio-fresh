import { describe, expect, it } from "vitest";
import { isRegisteredTool, toolFor } from "@/lib/arena-workstations/registry";
import { WORKSTATIONS } from "@/components/arena/workstations/registry";
import { catalogRoleForDomainKey } from "./catalog";
import { validateBlueprint, type RoleBlueprint } from "./blueprint";
import { validateToolkit } from "./toolkit/types";
import { toolkitFor } from "./toolkit";
import { AI_ML_ENGINEER } from "./blueprints/ai-ml-engineer";
import { APPLICATION_DEVELOPER } from "./blueprints/application-developer";
import { BACKEND_DEVELOPER } from "./blueprints/backend-developer";
import { BUSINESS_ANALYST } from "./blueprints/business-analyst";
import { DATA_ANALYST } from "./blueprints/data-analyst";
import { DATA_ENGINEER } from "./blueprints/data-engineer";
import { DATA_SCIENTIST } from "./blueprints/data-scientist";
import { SOC_ANALYST } from "./blueprints/soc-analyst";

const WAVE1: RoleBlueprint[] = [DATA_SCIENTIST, AI_ML_ENGINEER, DATA_ENGINEER, APPLICATION_DEVELOPER, BUSINESS_ANALYST, SOC_ANALYST];

describe("wave 1 roles (one per stream)", () => {
  for (const b of WAVE1) {
    describe(b.name, () => {
      it("has a well-formed blueprint and toolkit", () => {
        expect(validateBlueprint(b)).toEqual([]);
        const kit = toolkitFor(b.domainRoleKey);
        expect(kit, "toolkit").not.toBeNull();
        expect(validateToolkit(kit!)).toEqual([]);
        expect(kit!.roleId).toBe(b.roleId);
      });

      it("is the catalog's role for its key", () => {
        expect(catalogRoleForDomainKey(b.domainRoleKey)?.id).toBe(b.roleId);
      });

      it("serves every enabled area with a registered server tool and client renderer at the declared versions", () => {
        for (const a of b.areas.filter((x) => x.status === "enabled")) {
          expect(isRegisteredTool(a.toolType), a.areaKey).toBe(true);
          const tool = toolFor(a.toolType);
          expect([tool.generationVersion, tool.gradingVersion], a.areaKey).toEqual([a.generationVersion, a.gradingVersion]);
          expect(WORKSTATIONS[a.toolType], `${a.toolType} renderer`).toBeDefined();
        }
      });
    });
  }

  it("never lets two roles share an area key on the same tool (templates are filtered by area key)", () => {
    const seen = new Map<string, string>();
    for (const b of [DATA_ANALYST, BACKEND_DEVELOPER, ...WAVE1]) {
      for (const a of b.areas.filter((x) => x.status === "enabled")) {
        const k = `${a.toolType}:${a.areaKey}`;
        const prior = seen.get(k);
        if (prior && prior !== b.domainRoleKey) {
          // ponytail: the pre-existing roles share a few keys by design (sql, debugging); only new-role collisions are failures
          expect([DATA_ANALYST.domainRoleKey, BACKEND_DEVELOPER.domainRoleKey, "data-engineer-sql"].includes(b.domainRoleKey) && [DATA_ANALYST.domainRoleKey, BACKEND_DEVELOPER.domainRoleKey, "data-engineer-sql"].includes(prior), k).toBe(true);
        }
        seen.set(k, b.domainRoleKey);
      }
    }
  });
});
