export type NodeStatus = "NOT_ASSESSED" | "NOT_STARTED" | "LEARNING" | "SKIPPED" | "TARGET_MET" | "NEEDS_CHECK" | "LOCKED";
/** What the student says about a topic. There is no "done": a topic is only complete when evidence (Arena passes, projects, ...) reaches its target. */
export type UserNodeState = "LEARNING" | "SKIPPED" | null;

export interface StatusInput {
  /** null = not assessed */
  level: number | null;
  targetLevel: number;
  userState: UserNodeState;
  needsCheck: boolean;
  /** a prerequisite is still pending (see isPrerequisitePending) */
  locked: boolean;
}

/**
 * Pure. The one honest status of a node. Precedence: what the student said about it (skipped), then a flagged score, then a reached target, then
 * their own Learning note, then locked, then whether we know where they are at all.
 * "Not assessed" = no evidence; "Not started" = we know their level and it is below target, and they have not marked it.
 */
export function nodeStatus(i: StatusInput): NodeStatus {
  if (i.userState === "SKIPPED") return "SKIPPED";
  if (i.needsCheck) return "NEEDS_CHECK";
  if (i.level !== null && i.level >= i.targetLevel) return "TARGET_MET";
  if (i.userState === "LEARNING") return "LEARNING";
  if (i.locked) return "LOCKED";
  return i.level === null ? "NOT_ASSESSED" : "NOT_STARTED";
}

/** Fraction of a prerequisite's target it must reach before a dependent topic stops looking "locked". */
export const PREREQUISITE_FRACTION = 0.5;

/** Pure. A prerequisite is pending unless it is skipped or its level reaches half of its target. Unknown level = pending. */
export function isPrerequisitePending(pre: { level: number | null; targetLevel: number; userState: UserNodeState }): boolean {
  if (pre.userState === "SKIPPED") return false;
  return pre.level === null || pre.level < pre.targetLevel * PREREQUISITE_FRACTION;
}

/**
 * Skipping a node that other topics depend on is allowed (with a reason) but flagged, never hidden.
 */
export function skipWarnings(nodeKey: string, prerequisites: { from: string; to: string }[], titleOf: (key: string) => string): string[] {
  return prerequisites.filter((e) => e.from === nodeKey).map((e) => `Skipping ${titleOf(nodeKey)} may make ${titleOf(e.to)} harder: it is a prerequisite.`);
}
