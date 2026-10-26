import type { RoleToolkit } from "./types";
import { TOOLKIT as DATA_SCIENTIST } from "./data-scientist";
import { TOOLKIT as AI_ML_ENGINEER } from "./ai-ml-engineer";
import { TOOLKIT as DATA_ENGINEER } from "./data-engineer";
import { TOOLKIT as APPLICATION_DEVELOPER } from "./application-developer";
import { TOOLKIT as BUSINESS_ANALYST } from "./business-analyst";
import { TOOLKIT as SOC_ANALYST } from "./soc-analyst";
import { TOOLKIT as EMBEDDED } from "./embedded-systems-engineer";
import { TOOLKIT as IOT } from "./iot-firmware-engineer";
import { TOOLKIT as PLC } from "./plc-automation-engineer";
import { TOOLKIT as MECH } from "./mechanical-design-engineer";
import { TOOLKIT as SITE } from "./site-engineer";

/** Keyed by arena_domain_roles.role_key. A role with no descriptor gets null: the page shows nothing rather than another role's toolkit. */
const TOOLKITS: Record<string, RoleToolkit> = {
  "data-scientist": DATA_SCIENTIST,
  "ai-ml-engineer": AI_ML_ENGINEER,
  "data-engineer-sql": DATA_ENGINEER,
  "application-developer": APPLICATION_DEVELOPER,
  "business-analyst": BUSINESS_ANALYST,
  "soc-analyst": SOC_ANALYST,
  "embedded-systems-engineer": EMBEDDED,
  "iot-firmware-engineer": IOT,
  "plc-automation-engineer": PLC,
  "mechanical-design-engineer": MECH,
  "site-engineer": SITE,
};

export function toolkitFor(roleKey: string): RoleToolkit | null {
  return Object.hasOwn(TOOLKITS, roleKey) ? TOOLKITS[roleKey] : null;
}
