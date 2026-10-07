export const HIGH_LEVEL = 70;
export const LOW_PREREQUISITE_LEVEL = 30;

export interface ConsistencyFlag {
  nodeKey: string;
  prerequisiteKey: string;
  reason: "PREREQUISITE_NOT_ASSESSED" | "PREREQUISITE_LOW";
  message: string;
  /** a diagnostic on the prerequisite would settle it */
  suggestDiagnosticFor: string;
}

/**
 * Pure. A high score on a topic whose prerequisite has no evidence, or a low score, is suspicious (a lucky guess, a stale or mis-tagged result):
 * flag it as "Check this score" and point at the prerequisite to test. It never changes the score.
 */
export function consistencyFlags(
  prerequisites: { from: string; to: string }[],
  levels: ReadonlyMap<string, number | null>,
  titleOf: (key: string) => string
): ConsistencyFlag[] {
  const flags: ConsistencyFlag[] = [];
  for (const { from, to } of prerequisites) {
    const high = levels.get(to) ?? null;
    if (high === null || high < HIGH_LEVEL) continue;
    const pre = levels.get(from) ?? null;
    if (pre === null) flags.push({ nodeKey: to, prerequisiteKey: from, reason: "PREREQUISITE_NOT_ASSESSED", message: `Check this score: ${titleOf(to)} is high, but its prerequisite ${titleOf(from)} has not been assessed.`, suggestDiagnosticFor: from });
    else if (pre < LOW_PREREQUISITE_LEVEL) flags.push({ nodeKey: to, prerequisiteKey: from, reason: "PREREQUISITE_LOW", message: `Check this score: ${titleOf(to)} is high, but its prerequisite ${titleOf(from)} is low (${pre}).`, suggestDiagnosticFor: from });
  }
  return flags;
}
