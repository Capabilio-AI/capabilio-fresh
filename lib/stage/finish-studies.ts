import { hasProgrammeEnded } from "./stage";

/**
 * Pure. A student may declare "I have finished my studies" once their programme has ended or they are in their final year.
 * With no programme on file there is nothing to contradict the claim, so it is allowed (open product question: see the audit report).
 */
export function canDeclareGraduated(direction: { launchpadOpen: boolean; endYear: number | null } | null, now: Date = new Date()): boolean {
  if (!direction) return true;
  return direction.launchpadOpen || hasProgrammeEnded(direction.endYear, now);
}
