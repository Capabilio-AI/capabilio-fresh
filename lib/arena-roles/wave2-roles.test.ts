import { describe, expect, it } from "vitest";
import { isRegisteredTool, toolFor } from "@/lib/arena-workstations/registry";
import { WORKSTATIONS } from "@/components/arena/workstations/registry";
import { catalogRoleForDomainKey } from "./catalog";
import { validateBlueprint, type RoleBlueprint } from "./blueprint";
import { validateToolkit } from "./toolkit/types";
import { toolkitFor } from "./toolkit";
import { EMBEDDED_SYSTEMS_ENGINEER } from "./blueprints/embedded-systems-engineer";
import { IOT_FIRMWARE_ENGINEER } from "./blueprints/iot-firmware-engineer";
import { PLC_AUTOMATION_ENGINEER } from "./blueprints/plc-automation-engineer";
import { MECHANICAL_DESIGN_ENGINEER } from "./blueprints/mechanical-design-engineer";
import { SITE_ENGINEER } from "./blueprints/site-engineer";
import { isTemplateOnlyArea } from "@/lib/arena-workstations/template-only";

const WAVE2: RoleBlueprint[] = [EMBEDDED_SYSTEMS_ENGINEER, IOT_FIRMWARE_ENGINEER, PLC_AUTOMATION_ENGINEER, MECHANICAL_DESIGN_ENGINEER, SITE_ENGINEER];
// IoT is a stream of its own and has no row in the 45-role catalog
const NOT_IN_CATALOG = new Set(["iot-firmware-engineer"]);

describe("wave 2 roles (hardware streams)", () => {
  for (const b of WAVE2) {
    describe(b.name, () => {
      it("has a well-formed blueprint and toolkit", () => {
        expect(validateBlueprint(b)).toEqual([]);
        const kit = toolkitFor(b.domainRoleKey);
        expect(kit, "toolkit").not.toBeNull();
        expect(validateToolkit(kit!)).toEqual([]);
      });

      it("is the catalog's role for its key", () => {
        if (NOT_IN_CATALOG.has(b.domainRoleKey)) return;
        expect(catalogRoleForDomainKey(b.domainRoleKey)?.id).toBe(b.roleId);
      });

      it("serves every enabled area at the declared versions, and never asks the AI about a code area", () => {
        for (const a of b.areas.filter((x) => x.status === "enabled")) {
          expect(isRegisteredTool(a.toolType), a.areaKey).toBe(true);
          const tool = toolFor(a.toolType);
          expect([tool.generationVersion, tool.gradingVersion], a.areaKey).toEqual([a.generationVersion, a.gradingVersion]);
          expect(WORKSTATIONS[a.toolType], `${a.toolType} renderer`).toBeDefined();
          if (a.toolType === "code_workspace") expect(isTemplateOnlyArea(a.areaKey), `${a.areaKey} must skip AI`).toBe(true);
        }
      });
    });
  }
});
