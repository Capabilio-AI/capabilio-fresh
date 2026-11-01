import { ML_ENGINEER_AREAS } from "@/lib/workplace/ml-engineer/tickets";
import { ANALYST_PYTHON_AREAS } from "@/lib/workplace/analyst-python/templates";
import { DATA_SCIENCE_ML_AREAS } from "@/lib/workplace/data-science/ml-templates";

/**
 * Skill areas of the newer roles whose tickets come only from fixed templates. The shared AI generators have no brief for them, so asking the AI
 * would only produce off-topic tickets that are rejected (or worse, accepted under the wrong theme). Area keys are unique across roles.
 */
const TEMPLATE_ONLY_AREAS: ReadonlySet<string> = new Set([
  ...ML_ENGINEER_AREAS,
  ...DATA_SCIENCE_ML_AREAS,
  ...ANALYST_PYTHON_AREAS,
  "functions-and-logic",
  "api-handlers",
  "ui-state",
  "app-debugging",
  "ui-forms",
  "build-and-config",
  "emb-gpio-state-machines",
  "emb-sensors-and-thresholds",
  "emb-serial-protocols",
  "emb-timing",
  "iot-telemetry-payloads",
  "iot-device-logic",
  "iot-protocol-handling",
  "iot-ota-and-versions",
  "plc-boolean-logic",
  "plc-timers-counters",
  "plc-process-sequences",
  "plc-fault-handling",
]);

export const isTemplateOnlyArea = (areaKey: string | undefined): boolean => !!areaKey && TEMPLATE_ONLY_AREAS.has(areaKey);
