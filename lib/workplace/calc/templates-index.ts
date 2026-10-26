import type { CalcTemplate } from "./types";

import { EMBEDDED_CALC_TEMPLATES } from "./embedded";
import { IOT_CALC_TEMPLATES } from "./iot";
import { MECH_CALC_TEMPLATES } from "./mech";
import { PLC_CALC_TEMPLATES } from "./plc";
import { SITE_CALC_TEMPLATES } from "./site";

// One line per role module: add `import { X_CALC_TEMPLATES } from "./<role>";` and spread it below. Each role lives in its own file.
// (example.ts is for tests only and is deliberately not listed here.)

export const CALC_TEMPLATES: readonly CalcTemplate[] = [
  ...EMBEDDED_CALC_TEMPLATES,
  ...IOT_CALC_TEMPLATES,
  ...MECH_CALC_TEMPLATES,
  ...PLC_CALC_TEMPLATES,
  ...SITE_CALC_TEMPLATES,
];
