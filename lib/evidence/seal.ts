import { createHash } from "node:crypto";

/** Stored evidence is capped so one huge workbook cannot bloat the table; what is cut is said plainly, and the cut version is what the fingerprint covers. */
export const MAX_SUBMISSION_CHARS = 200_000;
export const EVIDENCE_SCHEMA_VERSION = 1;

/** JSON with sorted keys, so the same content always produces the same bytes whatever order the database returned the keys in. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const o = value as Record<string, unknown>;
  return `{${Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`).join(",")}}`;
}

export interface SealInput {
  attemptId: string;
  userId: string;
  roleKey: string;
  areaKey: string;
  areaName: string | null;
  company: string | null;
  skillIds: string[];
  difficulty: string;
  toolType: string | null;
  title: string;
  requester: string | null;
  scenario: string | null;
  objective: string | null;
  submission: unknown;
  grade: { passed: boolean; message: string; checks: { label: string; passed: boolean }[]; detail?: unknown };
  submissions: number;
  gradingVersion: string | null;
  generationVersion: string | null;
  assignedAt: string;
  completedAt: string;
  explained: boolean;
  explanationScore: number | null;
}

/** The columns that are sealed: everything a recruiter reads. `shared`, the student's own choice, is deliberately not part of it. */
export interface SealedContent extends Omit<SealInput, "attemptId" | "userId"> {
  schemaVersion: number;
}

/** Pure. The hex SHA-256 fingerprint of a record's sealed content. Changing any sealed field, even by one character, changes it. */
export function fingerprintOf(attemptId: string, userId: string, c: SealedContent): string {
  return createHash("sha256").update(canonicalJson({ attemptId, userId, ...c })).digest("hex");
}

/** Pure. The row to store for a passed task, with an oversize submission replaced by a note, and the fingerprint over exactly what is stored. */
export function sealEvidence(input: SealInput): { content: SealedContent; fingerprint: string; truncated: boolean } {
  const raw = canonicalJson(input.submission ?? null);
  const truncated = raw.length > MAX_SUBMISSION_CHARS;
  const submission = truncated ? { truncated: true, note: `The submission was ${raw.length.toLocaleString("en-IN")} characters and is too large to keep in full.` } : (input.submission ?? null);
  const { attemptId, userId, ...rest } = input;
  const content: SealedContent = { ...rest, submission, schemaVersion: EVIDENCE_SCHEMA_VERSION };
  return { content, fingerprint: fingerprintOf(attemptId, userId, content), truncated };
}

/** Pure. True when a stored record still matches the fingerprint it was sealed with. */
export function isIntact(attemptId: string, userId: string, c: SealedContent, fingerprint: string): boolean {
  return fingerprintOf(attemptId, userId, c) === fingerprint;
}
