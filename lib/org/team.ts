import { createHash, randomBytes } from "node:crypto";
import type { OrgContext } from "./context";
import { ALL_PERMISSION_KEYS, effectivePermissions, kindOf, type OrgPermissionKey } from "./roles";

export const INVITE_TTL_DAYS = 7;

/** A 256-bit URL-safe token. Only its SHA-256 is stored, so a database leak can't be replayed as an invite. */
export function newInviteToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token) };
}
export const hashToken = (token: string): string => createHash("sha256").update(token).digest("hex");

/** Short lowercase code for student join links (matches the table's ^[a-z0-9]{8,32}$ check). */
export function newJoinCode(): string {
  return randomBytes(9).toString("base64url").toLowerCase().replace(/[^a-z0-9]/g, "").padEnd(12, "x").slice(0, 12);
}

/**
 * Permissions a member may hand to someone else. Admins can grant anything; everyone else can only pass on what
 * they hold themselves, and never "Team & access" — so an invite can never be used to escalate privilege.
 */
export function grantablePermissions(ctx: Pick<OrgContext, "kind" | "permissions">): ReadonlySet<OrgPermissionKey> {
  if (ctx.kind === "admin") return new Set(ALL_PERMISSION_KEYS);
  return new Set([...ctx.permissions].filter((p) => p !== "members"));
}

export type GrantCheck = { ok: true } | { ok: false; message: string };

/** Validates a role + optional custom set an inviter (or editor) wants to assign. */
export function checkGrant(ctx: Pick<OrgContext, "kind" | "permissions">, role: string, permissions: readonly OrgPermissionKey[] | null | undefined): GrantCheck {
  if (kindOf(role) === "admin" && ctx.kind !== "admin") return { ok: false, message: "Only an admin can give full access." };
  const effective = effectivePermissions(role, permissions ?? null);
  const allowed = grantablePermissions(ctx);
  const beyond = [...effective].filter((p) => !allowed.has(p));
  if (beyond.length > 0) return { ok: false, message: "You can only give permissions you hold yourself." };
  return { ok: true };
}

/** Pure (given `now`): an invitation is usable only if unused, not cancelled and not past its expiry. */
export function isInvitationUsable<T extends { accepted_at: string | null; revoked_at: string | null; expires_at: string }>(inv: T | null, now: Date = new Date()): inv is T {
  return inv !== null && !inv.accepted_at && !inv.revoked_at && new Date(inv.expires_at).getTime() > now.getTime();
}

export function inviteUrl(origin: string, token: string): string {
  return `${origin}/invite/${token}`;
}

export function joinUrl(origin: string, code: string): string {
  return `${origin}/join/${code}`;
}
