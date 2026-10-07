import { FORMULA_TEXT, type EvidenceLine, type SkillScore } from "./capability";
import type { NodeStatus } from "./status";

/** The factual payload behind "Why this score": built here from stored data, never by a model and never in the browser. */
export interface ScoreExplanation {
  status: NodeStatus;
  /** null = not assessed yet */
  level: number | null;
  confidence: number | null;
  verified: boolean;
  target: { level: number; source: string };
  gap: number | null;
  formula: { version: string; text: string; snapshotLevel: number | null; practiceLevel: number | null; totalWeight: number };
  evidence: EvidenceLine[];
  /** shown when there is nothing to base a score on */
  noEvidence: boolean;
  /** one factual sentence for the headline */
  summary: string;
}

/** Pure. The deterministic explanation of one node's score. */
export function explainScore(args: { skillName: string; score: SkillScore | null; targetLevel: number; targetSource: string; status: NodeStatus }): ScoreExplanation {
  const { score, targetLevel } = args;
  const level = score?.level ?? null;
  const summary =
    level === null
      ? `${args.skillName} has not been assessed yet. The target is ${targetLevel}.`
      : level >= targetLevel
        ? `Your ${args.skillName} level is ${level}, which meets the target of ${targetLevel}.`
        : `Your ${args.skillName} level is ${level} against a target of ${targetLevel}${score && !score.verified ? " (self-declared only, so not verified)" : ""}.`;
  return {
    status: args.status,
    level,
    confidence: score && score.evidenceCount > 0 ? score.confidence : null,
    verified: score?.verified ?? false,
    target: { level: targetLevel, source: args.targetSource },
    gap: level === null ? null : Math.max(0, targetLevel - level),
    formula: { version: score?.formula.version ?? "capability.v2", text: FORMULA_TEXT, snapshotLevel: score?.formula.snapshotLevel ?? null, practiceLevel: score?.formula.practiceLevel ?? null, totalWeight: score?.formula.totalWeight ?? 0 },
    evidence: score?.lines ?? [],
    noEvidence: !score || score.evidenceCount === 0,
    summary,
  };
}
