import type { OrgContext } from "./context";

/** The comparison every branch match in the app uses (SQL: lower(btrim())). */
export const branchKey = (b: string | null | undefined) => (b ?? "").trim().toLowerCase();
export const sameBranch = (a: string | null | undefined, b: string | null | undefined) => branchKey(a) !== "" && branchKey(a) === branchKey(b);

/** Faculty / HoD whose membership names a branch are confined to it. Admins and staff with no branch are not. */
export function staffBranchScope(ctx: Pick<OrgContext, "kind" | "branch">): string | null {
  return ctx.kind === "staff" && branchKey(ctx.branch) ? (ctx.branch as string).trim() : null;
}

export type ScopeResult<T> = { ok: true; value: T } | { ok: false; message: string };

/** The branch a material is published to: a scoped member's own, and an explicit different one is refused rather than silently changed. */
export function resolveMaterialBranch(scope: string | null, requested: string | undefined): ScopeResult<string | undefined> {
  if (!scope) return { ok: true, value: requested };
  if (requested && !sameBranch(scope, requested)) return { ok: false, message: `You can only share materials with ${scope}.` };
  return { ok: true, value: scope };
}

/**
 * Whose dates a member may set. Admins choose any branch. Staff (an HOD, or faculty an admin trusted with it) may set their own branch's dates only, and a
 * staff member whose department is not on record may not set any: unlike a material, a date moves unlocks for a whole cohort, so there is no "everything" default.
 */
export function calendarScope(ctx: Pick<OrgContext, "kind" | "branch">): { ok: true; scope: string | null } | { ok: false; message: string } {
  if (ctx.kind !== "staff") return { ok: true, scope: null };
  const scope = staffBranchScope(ctx);
  return scope ? { ok: true, scope } : { ok: false, message: "Your department is not set on your membership yet, so you cannot set dates. Ask your college admin to add it." };
}

/**
 * The branch a calendar date is for. A branch-scoped member (an HOD) may set dates for their own branch only: "all branches" and other branches are
 * refused, not quietly changed, because a college-wide or another department's date is not theirs to move. Admins choose freely.
 */
export function resolveCalendarBranch(scope: string | null, requested: string): ScopeResult<string> {
  if (!scope) return { ok: true, value: requested };
  if (!sameBranch(scope, requested)) return { ok: false, message: `You can only set dates for ${scope}.` };
  return { ok: true, value: scope };
}

/** Which branches may see a project: a scoped member's own branch only; everyone else keeps whatever they chose (none = all branches). */
export function resolveProjectScope(scope: string | null, requested: readonly string[] | undefined): ScopeResult<string[] | null> {
  if (!scope) return { ok: true, value: requested?.length ? [...requested] : null };
  if (requested?.some((b) => !sameBranch(scope, b))) return { ok: false, message: `You can only post projects for ${scope}.` };
  return { ok: true, value: [scope] };
}
