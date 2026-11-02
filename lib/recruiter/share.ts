import { randomBytes } from "node:crypto";

export const EXPIRY_CHOICES = [7, 30, 90] as const;
export const MAX_RECORDS = 50;
export const MAX_LABEL = 80;

/** 192 bits of randomness as 32 URL-safe characters: not guessable, and nothing about the student is in it. */
export const newShareToken = (): string => randomBytes(24).toString("base64url");

export type ShareState = "active" | "expired" | "revoked";

export interface ShareLike {
  expiresAt: string;
  revokedAt: string | null;
}

/** Pure. Revoked wins over expired, so a student who revokes sees "revoked" and not a date that happens to have passed. */
export function shareState(s: ShareLike, now: Date): ShareState {
  if (s.revokedAt) return "revoked";
  return Date.parse(s.expiresAt) <= now.getTime() ? "expired" : "active";
}

export const expiryFrom = (days: number, now: Date): string => new Date(now.getTime() + days * 86_400_000).toISOString();

export interface ShareRequest {
  label: string;
  attemptIds: string[];
  days: number;
  includeContact: boolean;
}

/**
 * Pure. Checks a request to create a share against the student's own sealed records, and returns the cleaned request or the reason it is refused.
 * A student can only include records that are theirs and sealed; anything else is refused, never silently dropped, so a share never shows less than they chose.
 */
export function validateShareRequest(req: ShareRequest, ownSealedIds: ReadonlySet<string>): { ok: true; value: ShareRequest } | { ok: false; error: string } {
  const label = req.label.trim().replace(/\s+/g, " ");
  if (label.length === 0) return { ok: false, error: "Name this share, for example the company or recruiter it is for." };
  if (label.length > MAX_LABEL) return { ok: false, error: `Keep the name under ${MAX_LABEL} characters.` };
  const ids = [...new Set(req.attemptIds)];
  if (ids.length === 0) return { ok: false, error: "Choose at least one piece of work to include." };
  if (ids.length > MAX_RECORDS) return { ok: false, error: `A share can include up to ${MAX_RECORDS} pieces of work.` };
  if (ids.some((id) => !ownSealedIds.has(id))) return { ok: false, error: "One of the chosen items is not one of your sealed records." };
  if (!(EXPIRY_CHOICES as readonly number[]).includes(req.days)) return { ok: false, error: "Choose how long the link should work: 7, 30 or 90 days." };
  return { ok: true, value: { label, attemptIds: ids, days: req.days, includeContact: req.includeContact } };
}

/** Pure. Whether this share may open the evidence of one task: the link must be active and the task must be one the student put in it. */
export function mayOpen(share: ShareLike & { attemptIds: readonly string[] }, attemptId: string, now: Date): boolean {
  return shareState(share, now) === "active" && share.attemptIds.includes(attemptId);
}
