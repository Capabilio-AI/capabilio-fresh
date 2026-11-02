import { createHash } from "node:crypto";

/**
 * The ELO ledger keeps one event per (source, source_id), which is what makes a replay change nothing. A pass uses the attempt id. Each wrong answer needs its
 * own id that is the same every time it is computed for the same attempt and submission, so a retried request cannot charge a student twice.
 * Submission 0 is the id used for a skip.
 */
export function missEventId(attemptId: string, submissionNumber: number): string {
  const h = createHash("sha1").update(`arena-miss:${attemptId}:${submissionNumber}`).digest("hex");
  // shape a uuid (version 5, RFC variant) from the hash
  const variant = ((parseInt(h.slice(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, "0");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${variant}${h.slice(18, 20)}-${h.slice(20, 32)}`;
}
