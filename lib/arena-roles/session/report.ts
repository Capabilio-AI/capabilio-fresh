import type { SessionEvent } from "./events";
import { assessSession, type Dimension, type DimensionSignal } from "./signals";

export interface StageResult {
  key: string;
  title: string;
  passed: boolean;
  checksPassed: number;
  checksTotal: number;
}

export interface SessionReport {
  specKey: string;
  specVersion: number;
  roleId: string;
  /** a task-specific statement of what was demonstrated, built only from verified results */
  claim: string;
  stages: StageResult[];
  dimensions: Record<Dimension, DimensionSignal>;
  limitations: string[];
  /** events that failed validation and were left out */
  droppedEvents: number;
}

/**
 * Pure. Builds the report. Pass/fail and check counts come ONLY from `stages`, which the server fills from its own grading; the log can lower or
 * explain a dimension but can never change a result. The claim never says more than the numbers: no "certified", no job-readiness.
 */
export function buildReport(input: { specKey: string; specVersion: number; roleId: string; worldName: string; stages: StageResult[]; events: readonly SessionEvent[]; limitations: string[]; droppedEvents?: number }): SessionReport {
  const passedStages = input.stages.filter((s) => s.passed).length;
  const checksPassed = input.stages.reduce((n, s) => n + s.checksPassed, 0);
  const checksTotal = input.stages.reduce((n, s) => n + s.checksTotal, 0);
  const claim = `Completed ${passedStages} of ${input.stages.length} stage(s) of a simulated ${input.worldName} analysis; passed ${checksPassed} of ${checksTotal} assessment checks.`;
  return {
    specKey: input.specKey,
    specVersion: input.specVersion,
    roleId: input.roleId,
    claim,
    stages: input.stages,
    dimensions: assessSession(input.events, input.stages.map((s) => s.key), passedStages),
    limitations: input.limitations,
    droppedEvents: input.droppedEvents ?? 0,
  };
}
