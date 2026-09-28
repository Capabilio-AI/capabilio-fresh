export interface EvidenceRow {
  skill: string;
  evidenceType: "technology_usage" | "commit_activity" | "arena_result";
  sourceIdentifier: string;
  /** null when there is no external link to verify against (e.g. an internal Arena result) — never a placeholder string. */
  sourceUrl: string | null;
  observedAt: string | null;
  confidence: "low" | "medium" | "high";
  metadata: Record<string, unknown>;
}
