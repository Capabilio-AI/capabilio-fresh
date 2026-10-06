/**
 * Course/outcome -> skill mapping rules, PURE. The same invariants are enforced in the database by CHECK constraints
 * (047/048): an AI suggestion can never be CONFIRMED, and a CONFIRMED row always carries an approval time.
 * Only `isOfficial` rows may drive a student's roadmap.
 */
export type MappingStatus = "SUGGESTED" | "CONFIRMED" | "REJECTED";
export type MappingSource = "AI_SUGGESTED" | "COLLEGE_CONFIRMED" | "MANUAL" | "SYSTEM";
export type MappingImportance = "CORE" | "SUPPORTING" | "MINOR";

export interface MappingRow {
  skillId: string;
  status: MappingStatus;
  source: MappingSource;
  confidence: number | null;
  /** null = the college has not graded it; roadmap math treats that as SUPPORTING */
  importance: MappingImportance | null;
  evidence: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
}

export type AiProposal = { action: "insert" | "update"; row: MappingRow } | { action: "skip" };

/** What to do when the AI suggests a skill. Reviewed rows (CONFIRMED or REJECTED) are never touched, so a rejection sticks. */
export function proposeAiMapping(existing: MappingRow | null, c: { skillId: string; confidence: number | null; evidence: string | null }): AiProposal {
  if (existing && existing.status !== "SUGGESTED") return { action: "skip" };
  const row: MappingRow = {
    skillId: c.skillId, status: "SUGGESTED", source: "AI_SUGGESTED", confidence: c.confidence,
    importance: existing?.importance ?? null, evidence: c.evidence, approvedBy: null, approvedAt: null,
  };
  return { action: existing ? "update" : "insert", row };
}

/** A person confirms. A suggestion becomes COLLEGE_CONFIRMED; a skill they add (or re-add after rejecting) is MANUAL. Idempotent. */
export function confirmMapping(existing: MappingRow | null, by: { userId: string; now: string; skillId?: string }): MappingRow {
  if (existing?.status === "CONFIRMED") return existing;
  const skillId = existing?.skillId ?? by.skillId;
  if (!skillId) throw new Error("A skill id is required to add a mapping.");
  const fromSuggestion = existing?.status === "SUGGESTED";
  return {
    skillId, status: "CONFIRMED", source: fromSuggestion ? "COLLEGE_CONFIRMED" : "MANUAL",
    confidence: existing?.confidence ?? null, importance: existing?.importance ?? null, evidence: existing?.evidence ?? null,
    approvedBy: by.userId, approvedAt: by.now,
  };
}

/** Stored as REJECTED (not deleted) so the AI does not keep re-suggesting it. */
export function rejectMapping(existing: MappingRow, _by: { userId: string; now: string }): MappingRow {
  return { ...existing, status: "REJECTED", approvedBy: null, approvedAt: null };
}

export const isOfficial = (r: Pick<MappingRow, "status" | "source">): boolean => r.status === "CONFIRMED" && r.source !== "AI_SUGGESTED";
export const officialOnly = <T extends Pick<MappingRow, "status" | "source">>(rows: T[]): T[] => rows.filter(isOfficial);

export type ImportStatus = "DRAFT" | "EXTRACTED" | "UNDER_REVIEW" | "CONFIRMED" | "PUBLISHED" | "ARCHIVED";

// Mirrors the guard trigger on curriculum_imports (048). PUBLISHED is only reachable from CONFIRMED, via publish_curriculum_import().
const ALLOWED: Record<ImportStatus, ImportStatus[]> = {
  DRAFT: ["EXTRACTED"],
  EXTRACTED: ["UNDER_REVIEW"],
  UNDER_REVIEW: ["CONFIRMED", "EXTRACTED"],
  CONFIRMED: ["PUBLISHED", "UNDER_REVIEW"],
  PUBLISHED: ["ARCHIVED"],
  ARCHIVED: [],
};
export const canTransitionImport = (from: ImportStatus, to: ImportStatus): boolean => ALLOWED[from].includes(to);
